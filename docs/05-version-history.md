---
title: Version History
category: Working with Files
icon: History
order: 5
---

# Version History

When you replace a file, YFS keeps the earlier version, so you can look back
at or recover previous content.

## Opening Version History

Right-click a file and choose **Version History**, or use the
**Version History** button in the Details panel. It isn't available for
folders or while a file is locked, and it's hidden if file versioning is
turned off for your organization (your Profile shows whether it's enabled).

## What You'll See

| Row                      | Shows                                       | Actions                |
| ------------------------ | ------------------------------------------- | ---------------------- |
| **Current version (vN)** | The version in use, with its date and size. | View, Delete           |
| **Version N**            | Each earlier version.                       | View, Download, Delete |

If the file has never been replaced, the dialog says "No earlier versions
yet — replacing this file creates one."

## Actions

| Action       | What it does                                                         |
| ------------ | -------------------------------------------------------------------- |
| **View**     | Opens that version in a read-only viewer, labelled "*file name* · Version N". |
| **Download** | Saves an earlier version, named with its version number (for example, v2-report.docx). To download the current version, use the regular **Download** action. |
| **Delete**   | Removes that version after you confirm.                              |

## Rules for Deleting Versions

- **Version 1** can't be deleted on its own.
- If the current version is the **only** version, deleting it deletes the
  whole file.
- In folders shared with you, deleting versions requires the **Delete**
  permission.