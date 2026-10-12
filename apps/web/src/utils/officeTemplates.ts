/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import JSZip from "jszip";

export type OfficeKind = "document" | "spreadsheet" | "presentation";

export const OFFICE_KINDS: Record<OfficeKind, { label: string; extension: string; mime: string }> = {
  document: {
    label: "Document",
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  spreadsheet: {
    label: "Spreadsheet",
    extension: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  presentation: {
    label: "Presentation",
    extension: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
};

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const CT = "application/vnd.openxmlformats-officedocument";

const contentTypes = (overrides: [string, string][]) =>
  XML_DECL +
  `<Types xmlns="${NS_CT}">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  overrides.map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`).join("") +
  `</Types>`;

const relationships = (rels: [string, string][]) =>
  XML_DECL +
  `<Relationships xmlns="${NS_PKG_REL}">` +
  rels.map(([type, target], i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/${type}" Target="${target}"/>`).join("") +
  `</Relationships>`;

const emptySpTree =
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>`;

const repeat = (xml: string, n = 3) => xml.repeat(n);

const THEME =
  XML_DECL +
  `<a:theme xmlns:a="${NS_A}" name="Office Theme"><a:themeElements>` +
  `<a:clrScheme name="Office">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>` +
  `</a:clrScheme>` +
  `<a:fontScheme name="Office">` +
  `<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
  `</a:fontScheme>` +
  `<a:fmtScheme name="Office">` +
  `<a:fillStyleLst>${repeat(`<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`)}</a:fillStyleLst>` +
  `<a:lnStyleLst>${repeat(`<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`)}</a:lnStyleLst>` +
  `<a:effectStyleLst>${repeat(`<a:effectStyle><a:effectLst/></a:effectStyle>`)}</a:effectStyleLst>` +
  `<a:bgFillStyleLst>${repeat(`<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`)}</a:bgFillStyleLst>` +
  `</a:fmtScheme>` +
  `</a:themeElements></a:theme>`;

const DOCX_PARTS: Record<string, string> = {
  "[Content_Types].xml": contentTypes([["/word/document.xml", `${CT}.wordprocessingml.document.main+xml`]]),
  "_rels/.rels": relationships([["officeDocument", "word/document.xml"]]),
  "word/document.xml":
    XML_DECL +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/>` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`,
};

const XLSX_PARTS: Record<string, string> = {
  "[Content_Types].xml": contentTypes([
    ["/xl/workbook.xml", `${CT}.spreadsheetml.sheet.main+xml`],
    ["/xl/worksheets/sheet1.xml", `${CT}.spreadsheetml.worksheet+xml`],
  ]),
  "_rels/.rels": relationships([["officeDocument", "xl/workbook.xml"]]),
  "xl/workbook.xml":
    XML_DECL +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": relationships([["worksheet", "worksheets/sheet1.xml"]]),
  "xl/worksheets/sheet1.xml":
    XML_DECL + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`,
};

const PPTX_NS = `xmlns:a="${NS_A}" xmlns:r="${NS_REL}" xmlns:p="${NS_P}"`;

const PPTX_PARTS: Record<string, string> = {
  "[Content_Types].xml": contentTypes([
    ["/ppt/presentation.xml", `${CT}.presentationml.presentation.main+xml`],
    ["/ppt/slideMasters/slideMaster1.xml", `${CT}.presentationml.slideMaster+xml`],
    ["/ppt/slideLayouts/slideLayout1.xml", `${CT}.presentationml.slideLayout+xml`],
    ["/ppt/slides/slide1.xml", `${CT}.presentationml.slide+xml`],
    ["/ppt/theme/theme1.xml", `${CT}.theme+xml`],
  ]),
  "_rels/.rels": relationships([["officeDocument", "ppt/presentation.xml"]]),
  "ppt/presentation.xml":
    XML_DECL +
    `<p:presentation ${PPTX_NS}>` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
    `<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>` +
    `</p:presentation>`,
  "ppt/_rels/presentation.xml.rels": relationships([
    ["slideMaster", "slideMasters/slideMaster1.xml"],
    ["slide", "slides/slide1.xml"],
    ["theme", "theme/theme1.xml"],
  ]),
  "ppt/slideMasters/slideMaster1.xml":
    XML_DECL +
    `<p:sldMaster ${PPTX_NS}>` +
    `<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${emptySpTree}</p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ` +
    `accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `</p:sldMaster>`,
  "ppt/slideMasters/_rels/slideMaster1.xml.rels": relationships([
    ["slideLayout", "../slideLayouts/slideLayout1.xml"],
    ["theme", "../theme/theme1.xml"],
  ]),
  "ppt/slideLayouts/slideLayout1.xml":
    XML_DECL +
    `<p:sldLayout ${PPTX_NS} type="blank" preserve="1">` +
    `<p:cSld name="Blank">${emptySpTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sldLayout>`,
  "ppt/slideLayouts/_rels/slideLayout1.xml.rels": relationships([["slideMaster", "../slideMasters/slideMaster1.xml"]]),
  "ppt/slides/slide1.xml":
    XML_DECL +
    `<p:sld ${PPTX_NS}><p:cSld>${emptySpTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
  "ppt/slides/_rels/slide1.xml.rels": relationships([["slideLayout", "../slideLayouts/slideLayout1.xml"]]),
  "ppt/theme/theme1.xml": THEME,
};

const PARTS: Record<OfficeKind, Record<string, string>> = {
  document: DOCX_PARTS,
  spreadsheet: XLSX_PARTS,
  presentation: PPTX_PARTS,
};

// Appends the kind's extension unless the name already ends with it.
export const withOfficeExtension = (name: string, kind: OfficeKind): string => {
  const ext = OFFICE_KINDS[kind].extension;
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith(`.${ext}`) ? trimmed : `${trimmed}.${ext}`;
};

// A valid, empty OOXML file, so it downloads and opens anywhere, not just in Collabora.
export const createBlankOfficeFile = async (kind: OfficeKind, fileName: string): Promise<File> => {
  const zip = new JSZip();
  for (const [path, xml] of Object.entries(PARTS[kind])) zip.file(path, xml, { createFolders: false });
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: OFFICE_KINDS[kind].mime });
  return new File([blob], fileName, { type: OFFICE_KINDS[kind].mime });
};
