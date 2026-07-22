import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DocsSidebar, { DOC_SECTIONS } from '@/components/docs/DocsSidebar';
import OverviewSection from '@/components/docs/sections/OverviewSection';
import CosCalculateSection from '@/components/docs/sections/CosCalculateSection';
import DdexExportSection from '@/components/docs/sections/DdexExportSection';
import ManifestSection from '@/components/docs/sections/ManifestSection';
import Id3ComplianceSection from '@/components/docs/sections/Id3ComplianceSection';
import OnChainRegistrationSection from '@/components/docs/sections/OnChainRegistrationSection';
import BaseMarkSection from '@/components/docs/sections/BaseMarkSection';

const SECTION_COMPONENTS = {
  'overview': OverviewSection,
  'cos-calculate': CosCalculateSection,
  'ddex-export': DdexExportSection,
  'provenance-manifest': ManifestSection,
  'id3-compliance': Id3ComplianceSection,
  'onchain-registration': OnChainRegistrationSection,
  'base-mark': BaseMarkSection,
};

export default function DocsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('section');
  const [active, setActive] = useState(
    DOC_SECTIONS.some((s) => s.id === initial) ? initial : 'overview'
  );

  const select = (id) => {
    setActive(id);
    setSearchParams({ section: id }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const ActiveSection = SECTION_COMPONENTS[active] || OverviewSection;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-24 rounded-2xl border border-border bg-card p-4">
              <DocsSidebar active={active} onSelect={select} />
            </div>
          </aside>
          <main className="flex-1 min-w-0">
            <ActiveSection />
          </main>
        </div>
      </div>
    </div>
  );
}