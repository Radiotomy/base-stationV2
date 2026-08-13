import { useEffect, useRef, useState } from 'react';

/**
 * Boots the browser-based Shotstack Studio SDK (canvas preview + drag-and-drop
 * timeline) against the given template. The SDK mounts itself into the
 * [data-shotstack-studio] and [data-shotstack-timeline] elements, so those
 * containers must be rendered before this hook runs.
 *
 * Returns { edit, ready, error } — `edit` is the live Edit instance
 * (edit.getEdit(), edit.addClip(), edit.play(), edit.undo() …).
 */
export function useShotstackStudio(template) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const editRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let instances = [];

    (async () => {
      try {
        // Loaded dynamically — the SDK touches the DOM/WebGL at module scope
        const { Edit, Canvas, Controls, Timeline } = await import('@shotstack/shotstack-studio');

        const edit = new Edit(template);
        const canvas = new Canvas(edit);
        await canvas.load();
        await edit.load();
        if (disposed) { canvas.dispose?.(); edit.dispose?.(); return; }

        const controls = new Controls(edit);
        await controls.load();

        const timelineContainer = document.querySelector('[data-shotstack-timeline]');
        const timeline = new Timeline(edit, timelineContainer, { resizable: true });
        await timeline.load();

        instances = [timeline, controls, canvas, edit];
        editRef.current = edit;
        if (!disposed) setReady(true);
      } catch (err) {
        if (!disposed) setError(err.message || 'Failed to load the timeline editor');
      }
    })();

    return () => {
      disposed = true;
      instances.forEach(i => { try { i.dispose?.(); } catch { /* noop */ } });
      editRef.current = null;
    };
    // Intentionally boots once per mount — template changes are applied via the editor itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { edit: editRef, ready, error };
}