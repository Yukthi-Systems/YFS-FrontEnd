# @yfs/mobile (placeholder)

This folder reserves the spot for the future mobile app so the workspace layout
doesn't need to change later. It's not scaffolded yet.

When you're ready to start it, the simplest path is Expo:

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
```

Then, same as `apps/web`:
1. Set `"name": "@yfs/mobile"` in `apps/mobile/package.json`.
2. Add `"@yfs/utils": "*"` to its dependencies.
3. Run `npm install` from the repo root.
4. Import shared code the same way the web app does: `import { capitalize } from "@yfs/utils"`.

See the root `GUIDE.md` for the full explanation of how the workspace wiring works.
