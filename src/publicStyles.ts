/**
 * Mantine's stylesheet for the public site — only the components it actually shows.
 *
 * The full `@mantine/core/styles.css` is 37 KB gzip and carries every component in the library:
 * the doctor's workspace uses most of them, a landing page uses fifteen. Loading all of it on the
 * first screen a visitor sees costs more than everything else on that screen put together.
 *
 * **Adding a Mantine component to a public page means adding its stylesheet here.** Forgetting is
 * not a crash but an unstyled element, so the list is kept in one place, alphabetical, and the
 * public pages are looked at after every change to them.
 *
 * `baseline`, `default-css-variables` and `global` are the base Mantine expects underneath the
 * per-component files and are not optional.
 */
import '@mantine/core/styles/baseline.css';
import '@mantine/core/styles/default-css-variables.css';
import '@mantine/core/styles/global.css';

import '@mantine/core/styles/Accordion.css';
import '@mantine/core/styles/ActionIcon.css';
import '@mantine/core/styles/Alert.css';
import '@mantine/core/styles/Anchor.css';
import '@mantine/core/styles/Badge.css';
import '@mantine/core/styles/Button.css';
import '@mantine/core/styles/Card.css';
import '@mantine/core/styles/Divider.css';
import '@mantine/core/styles/Image.css';
import '@mantine/core/styles/Input.css';
import '@mantine/core/styles/List.css';
import '@mantine/core/styles/Loader.css';
import '@mantine/core/styles/Paper.css';
import '@mantine/core/styles/PasswordInput.css';
import '@mantine/core/styles/ThemeIcon.css';
import '@mantine/core/styles/Title.css';
import '@mantine/core/styles/UnstyledButton.css';
import '@mantine/core/styles/VisuallyHidden.css';
