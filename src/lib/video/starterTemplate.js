/**
 * Starter Shotstack edit used to seed the Studio SDK timeline editor.
 * One title clip over a dark background — the user drags, trims and adds
 * their own footage/audio from there.
 */
export function buildStarterTemplate(size = { width: 1280, height: 720 }) {
  return {
    timeline: {
      background: '#14100C',
      tracks: [
        {
          clips: [
            {
              asset: {
                type: 'rich-text',
                text: 'BASE STATION',
                font: { family: 'Work Sans', size: 64, weight: 600, color: '#ffffff', opacity: 1 },
                align: { horizontal: 'center', vertical: 'middle' },
              },
              start: 0,
              length: 4,
              width: 900,
              height: 200,
              transition: { in: 'fade', out: 'fade' },
            },
          ],
        },
      ],
    },
    output: { format: 'mp4', fps: 25, size },
  };
}