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
                type: 'text',
                text: 'BASE STATION',
                font: { family: 'Montserrat ExtraBold', size: 64, color: '#ffffff' },
                alignment: { horizontal: 'center', vertical: 'center' },
              },
              start: 0,
              length: 4,
              transition: { in: 'fade', out: 'fade' },
            },
          ],
        },
      ],
    },
    output: { format: 'mp4', fps: 25, size },
  };
}