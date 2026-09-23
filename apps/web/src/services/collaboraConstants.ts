// Split out from collaboraClient.ts on purpose: collaboraClient.ts pulls in axios
// (fetchDiscovery), and CollaboraStandaloneView.tsx is imported eagerly by main.tsx
// (it has to be — the route decision there is synchronous on window.location.pathname)
// rather than lazily like CollaboraViewer.tsx is from ViewerModal. Importing
// COLLABORA_BASE_URL from collaboraClient.ts there would drag axios into the main
// bundle for every visitor, not just the ones who open a Collabora file. This constant
// has no dependencies of its own, so it's safe for both eager and lazy call sites.
export const COLLABORA_BASE_URL = "https://collabora-1.files.test.yukthi.net";
