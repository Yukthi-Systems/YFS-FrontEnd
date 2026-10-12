---
title: Shared by Link
category: Sharing
icon: Link
order: 11
---

# Shared by Link

Shared by link lists every public link you've created in one place, so you
can copy, update, or turn off links without going back to the original file
or folder. Open it from **Shares → Shared by link** in the sidebar. The
number next to the page title is how many links you have.

Links are created from an item's **Share → Public links** tab (see
**Sharing**). This page is where you manage them afterwards.

## Reading a Link Card

| Part                | What it tells you                                                       |
| ------------------- | ----------------------------------------------------------------------- |
| **Icon**            | A folder icon for folder links, a document icon for file links. Greyed out once the link expires. |
| **Address**         | The full link visitors open, ending in `/share/<link-id>`.              |
| **Permission tags** | What visitors are allowed to do. Only granted permissions are shown.    |
| **Password**        | Appears when the link is password-protected.                            |
| **OTP to N**        | Visitors must verify with a one-time code. Hover to see the approved emails and phone numbers. |
| **Expiry**          | "No expiry", "Expires *date*", or "Expired *date*" in red.              |
| **Created**         | The date you created the link.                                          |

Once a link's end date has passed, a red **Expired** tag appears next to its
address. Expired links stay in the list until you revoke them.

## Card Actions

| Button          | What it does                                                          |
| --------------- | --------------------------------------------------------------------- |
| **Share**       | Opens your device's share sheet where supported; otherwise copies the link. |
| **Copy link**   | Copies the address to your clipboard. A check mark confirms it.       |
| **Edit link**   | Opens the Edit link dialog. Clicking anywhere on the card does the same. |
| **Revoke link** | Deletes the link. Anyone using it loses access straight away.         |

Revoking can't be undone. To share the item again, create a new link from
its **Share → Public links** tab.

## Editing a Link

The **Edit link** dialog shows the link's address with a **Copy** button,
followed by its settings. The address itself can't be changed.

### Permissions

Tick what visitors may do: **Preview**, **Download**, **Create**, **Edit**,
and **Delete**. On folder links, **Create** lets visitors add folders,
**Edit** lets them rename folders, and both together let them move folders.

### Protection

| Setting               | How it works                                                     |
| --------------------- | ---------------------------------------------------------------- |
| **Set a password**    | Tick it and type a password. If the link already has one, this reads **Change or remove password** — enter a new one, or leave the field blank to remove it. Leave the box unticked to keep the current password. |
| **OTP emails**        | Email addresses allowed to receive a verification code, separated by commas. |
| **OTP phone numbers** | Choose the country code, type the number, and press **+** to add it. Add as many numbers as you need. |
| **Expires**           | The last day the link works — it stops at the end of that day. Clear the date for no expiry. |

A password and one-time codes can be used together; visitors must pass both.

Press **Save changes** to apply your edits ("Link updated" confirms), or
**Cancel** to close without saving.

### Expiry Rules

- The date can't be in the past, and can't be more than **3 months** from today.
- **Save changes** stays disabled until the date is valid.
- To bring an expired link back, open it and pick a new date or clear the
  field — the old date has to be changed before anything else can be saved.

## Good to Know

- Visitors can browse folder links, but opening or downloading individual
  files from a link isn't available yet. A file link confirms the visitor's
  access and suggests asking you to share it with their YFS account instead.
- Give only the permissions people need — **Preview** alone is read-only.
- Use an expiry date for anything temporary, so links don't stay open
  longer than intended.

## No Links Yet?

If you haven't created any public links, the page says so. Open a file or
folder's **Share** dialog and use the **Public links** tab to create one.