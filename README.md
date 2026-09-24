# Yukthi File System (YFS) — Web UI

The web front end for **Yukthi File System**, a self-hostable file storage and sharing platform. Browse, upload, preview, edit and share files and folders from the browser, with resumable uploads, version history, public links and in-browser document editing through Collabora Online.

[![Discord](https://img.shields.io/discord/29zTxvque?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/29zTxvque)

> 💬 **Join our community on Discord:** [discord.gg/29zTxvque](https://discord.gg/29zTxvque) — ask questions, report bugs, share ideas, and get involved.

## 🔗 Related Projects

| Project | Description |
| --- | --- |
| [YFS-Main-API](https://github.com/Yukthi-Systems/YFS-Main-API) | Core API (Rust / Actix) — auth, folders, file metadata, sharing, users |
| [YFS-Files-Api](https://github.com/Yukthi-Systems/YFS-Files-Api) | Storage API (Go) — tus uploads, downloads, media streaming, WOPI |

## 🚀 Features

- **My Drive:** folders and files with list, tiles and grid views, sorting, drag-and-drop moves, marquee selection and keyboard shortcuts.
- **Uploads:** resumable, chunked uploads over [tus](https://tus.io/), whole-folder uploads, pause/resume/cancel, and automatic resume after a network drop.
- **Previews:** images, video and audio streaming, PDFs, code and text, spreadsheets and Word documents in the browser.
- **Document editing:** Office and OpenDocument files open in [Collabora Online](https://www.collaboraoffice.com/) through WOPI.
- **Version history:** browse, download and delete earlier versions of a file.
- **Sharing:** share folders with people in your organization with granular permissions, or create public links with an optional password and expiry date.
- **Public link view:** anonymous visitors can browse a shared folder, and create, rename and move folders when the link allows it.
- **Trash:** a recycle bin with restore and permanent delete.
- **Search:** across file names and file contents.
- **Personalisation:** light/dark themes, accent colours, folder colours and icons, all synced to your account.

## 🛠️ Tech Stack

- **Core:** React 19, TypeScript, Vite
- **State & data:** [Jotai](https://jotai.org/) for client state, [TanStack Query](https://tanstack.com/query) for server state
- **Styling:** Tailwind CSS v4, [Lucide](https://lucide.dev/) icons
- **Uploads:** tus-js-client
- **Viewers:** react-pdf, CodeMirror, SheetJS, mammoth
- **Auth:** Yukthi SSO
- **Tooling:** npm workspaces, Oxlint

## 📁 Project Structure

This is an [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) monorepo:

```
apps/
  web/        the web app (Vite + React)
  mobile/     placeholder for a future mobile app
packages/
  service/    API client for YFS-Main-API (@yfs/service)
  utils/      small shared helpers (@yfs/utils)
```

Workspaces depend on each other with `"@yfs/<name>": "*"` and are linked by `npm install`, so edits to `packages/*` hot-reload in the app with no build step.

## 📦 Getting Started

### Prerequisites

- Node.js 22 or newer
- npm
- A running [YFS-Main-API](https://github.com/Yukthi-Systems/YFS-Main-API) and [YFS-Files-Api](https://github.com/Yukthi-Systems/YFS-Files-Api), plus a Yukthi SSO instance

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Yukthi-Systems/YFS-FrontEnd
cd YFS-FrontEnd
```

2. Install dependencies (from the repo root, for every workspace):

```bash
npm install
```

3. Configure the environment (used by the dev server; containers read the same keys at runtime):

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | YFS-Main-API base URL |
| `VITE_SSO_URL` | Yukthi SSO base URL |
| `VITE_SSO_APP_ID` | App id registered with the SSO service |
| `VITE_STORAGE_URL` | Storage API origin, used when an upload session has no `base_url` |
| `VITE_COLLABORA_URL` | Collabora Online origin |
| `VITE_COLLABORA_LOADER_URL` | Optional. Collabora loader URL used when `discovery.xml` can't be fetched |

## 💻 Development

Start the dev server with Hot Module Replacement:

```bash
npm run dev
```

The app runs at `http://localhost:5173` (or the port shown in your terminal).

## 🏗️ Building for Production

```bash
npm run build
```

This type-checks with `tsc` and builds the optimized assets into `apps/web/dist`.

### Docker

```bash
docker build -t yfs-ui .
docker run -p 3000:3000 --env-file .env yfs-ui
```

No URLs are baked into the image. On start, the container writes the `VITE_*` variables from its environment into `env-config.js`, which the app reads at runtime. With Docker Compose, put them in a `.env` file next to `docker-compose.yml` (same keys as `apps/web/.env.example`).

## 🧹 Code Quality

```bash
npm run lint        # Oxlint
npm run typecheck   # tsc across every workspace
```

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

1. Fork the project
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Found a bug or have a feature request? [Open an issue](https://github.com/Yukthi-Systems/YFS-FrontEnd/issues/new/choose). For security issues, see [SECURITY.md](SECURITY.md).

## 💬 Community

Join our [Discord server](https://discord.gg/29zTxvque) to chat with maintainers and other contributors, ask questions, and stay up to date with the project.

## 📄 License

[GNU General Public License v3.0](LICENSE) © Yukthi Systems Private Limited
