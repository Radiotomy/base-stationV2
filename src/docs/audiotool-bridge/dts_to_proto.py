"""Rebuild Audiotool's .proto sources from the published @audiotool/nexus package.

Audiotool publishes its *website* protos (projects, presets, samples) as a zip,
but the DOCUMENT protos -- notes, automation, devices, cables, tracks, i.e. the
actual session state -- only ship inside the nexus npm package as protobuf-es
generated code. Every generated class and enum carries its exact proto
declaration in a "@generated from ..." comment, so the .proto files can be
reconstructed losslessly: same packages, message names, field numbers and types.
Those are all the wire format depends on, so bytes produced by Audiotool's
servers parse with the resulting Python bindings exactly as they do in the SDK.

Pinned to a nexus version so the bindings are reproducible; bump NEXUS_VERSION
in the Dockerfile to pick up new entity types.

Usage: python dts_to_proto.py <nexus-version> <out-dir>
"""
import io
import os
import re
import sys
import tarfile
import urllib.request

SCALARS = {
    "double", "float", "int32", "int64", "uint32", "uint64", "sint32", "sint64",
    "fixed32", "fixed64", "sfixed32", "sfixed64", "bool", "string", "bytes",
}
WKT = {
    "Any": "any", "Timestamp": "timestamp", "Duration": "duration", "Empty": "empty",
    "FieldMask": "field_mask", "Struct": "struct", "Value": "struct", "ListValue": "struct",
    "NullValue": "struct", "DoubleValue": "wrappers", "FloatValue": "wrappers",
    "Int64Value": "wrappers", "UInt64Value": "wrappers", "Int32Value": "wrappers",
    "UInt32Value": "wrappers", "BoolValue": "wrappers", "StringValue": "wrappers",
    "BytesValue": "wrappers",
}

RE_MSG = re.compile(r"@generated from message ([\w.]+)\s*$")
RE_ENUM = re.compile(r"@generated from enum ([\w.]+)\s*$")
RE_ENUM_VAL = re.compile(r"@generated from enum value: (\w+) = (-?\d+);")
RE_ONEOF = re.compile(r"^(\s*)\* @generated from oneof ([\w.]+)")
RE_FIELD = re.compile(
    r"^(\s*)\* @generated from field: (repeated )?(map<\s*(\w+),\s*([\w.]+)\s*>|[\w.]+) (\w+) = (\d+)"
)


def split_fqn(fqn):
    parts = fqn.split(".")
    i = next(i for i, p in enumerate(parts) if p[:1].isupper())
    return ".".join(parts[:i]), parts[i:]


def parse_file(text):
    defs, cur, oneof, oneof_indent = [], None, None, None
    for line in text.splitlines():
        m = RE_MSG.search(line)
        if m:
            cur = {"kind": "message", "fqn": m.group(1), "fields": [], "oneofs": []}
            defs.append(cur)
            oneof = None
            continue
        m = RE_ENUM.search(line)
        if m:
            cur = {"kind": "enum", "fqn": m.group(1), "values": []}
            defs.append(cur)
            oneof = None
            continue
        if cur is None:
            continue
        if cur["kind"] == "enum":
            m = RE_ENUM_VAL.search(line)
            if m:
                cur["values"].append((m.group(1), int(m.group(2))))
            continue
        m = RE_ONEOF.match(line)
        if m:
            oneof, oneof_indent = m.group(2).split(".")[-1], len(m.group(1))
            cur["oneofs"].append(oneof)
            continue
        m = RE_FIELD.match(line)
        if m:
            # oneof members are nested one level deeper than the oneof property itself
            if oneof and len(m.group(1)) <= oneof_indent:
                oneof = None
            cur["fields"].append({
                "repeated": bool(m.group(2)),
                "map": (m.group(4), m.group(5)) if m.group(4) else None,
                "type": m.group(3), "name": m.group(6), "no": int(m.group(7)),
                "oneof": oneof,
            })
    return defs


def type_ref(t, used):
    if t in SCALARS:
        return t
    used.add(t)
    return "." + t


def render(files, owner):
    out, missing = {}, set()
    for path, defs in files.items():
        pkg = split_fqn(defs[0]["fqn"])[0]
        used, tree = set(), {}
        for d in defs:
            _, rel = split_fqn(d["fqn"])
            node = tree
            for part in rel[:-1]:
                node = node.setdefault(part, {"_children": {}})["_children"]
            node.setdefault(rel[-1], {"_children": {}})["_def"] = d

        def emit(name, node, ind):
            d, lines, pad = node.get("_def"), [], "  " * ind
            if d and d["kind"] == "enum":
                lines.append(f"{pad}enum {name} {{")
                for vn, vv in d["values"]:
                    lines.append(f"{pad}  {vn} = {vv};")
                lines.append(f"{pad}}}")
                return lines
            lines.append(f"{pad}message {name} {{")
            for cn, cnode in node["_children"].items():
                lines += emit(cn, cnode, ind + 1)
            fields = d["fields"] if d else []
            for f in [f for f in fields if not f["oneof"]]:
                if f["map"]:
                    k, v = f["map"]
                    lines.append(f"{pad}  map<{k}, {type_ref(v, used)}> {f['name']} = {f['no']};")
                else:
                    rep = "repeated " if f["repeated"] else ""
                    lines.append(f"{pad}  {rep}{type_ref(f['type'], used)} {f['name']} = {f['no']};")
            for o in (d["oneofs"] if d else []):
                lines.append(f"{pad}  oneof {o} {{")
                for f in [f for f in fields if f["oneof"] == o]:
                    lines.append(f"{pad}    {type_ref(f['type'], used)} {f['name']} = {f['no']};")
                lines.append(f"{pad}  }}")
            lines.append(f"{pad}}}")
            return lines

        body = []
        for name, node in tree.items():
            body += emit(name, node, 0)
        imports = set()
        for t in used:
            if t.startswith("google.protobuf."):
                imports.add(f"google/protobuf/{WKT[t.split('.')[-1]]}.proto")
            elif t in owner:
                if owner[t] != path:
                    imports.add(owner[t])
            else:
                missing.add(t)
        head = ['syntax = "proto3";', "", f"package {pkg};", ""]
        head += [f'import "{i}";' for i in sorted(imports)]
        out[path] = "\n".join(head + [""] + body) + "\n"
    return out, missing


def main(version, out_dir):
    url = f"https://registry.npmjs.org/@audiotool/nexus/-/nexus-{version}.tgz"
    raw = urllib.request.urlopen(url, timeout=60).read()
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
        for member in tar.getmembers():
            n = member.name
            if "/dist/gen/audiotool/" in n and n.endswith("_pb.d.ts"):
                defs = parse_file(tar.extractfile(member).read().decode("utf-8"))
                if defs:
                    files[n.split("/dist/gen/", 1)[1].replace("_pb.d.ts", ".proto")] = defs

    # A few d.ts files re-declare a message owned by another file; keep each
    # type in the file named after it, otherwise protoc rejects the duplicate.
    owner = {}
    for path, defs in sorted(files.items()):
        stem = os.path.basename(path)[:-6]
        for d in defs:
            snake = re.sub(r"(?<!^)(?=[A-Z])", "_", d["fqn"].split(".")[-1]).lower()
            if d["fqn"] not in owner or stem == snake:
                owner[d["fqn"]] = path
    files = {p: [d for d in defs if owner[d["fqn"]] == p] for p, defs in files.items()}
    files = {p: defs for p, defs in files.items() if defs}

    rendered, missing = render(files, owner)
    if missing:
        sys.exit(f"unresolved proto types: {sorted(missing)}")
    for rel, src in rendered.items():
        dest = os.path.join(out_dir, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as fh:
            fh.write(src)
    print(f"wrote {len(rendered)} proto files from @audiotool/nexus {version}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])