import { useEffect, useState, useRef } from "react";
import { capitalize, slugify, formatCurrency } from "@yfs/utils";
import { getJson, API_BASE_URL, getApiJson } from "@yfs/service";
import { useAuth } from "./context/AuthContext";
import "./App.css";

// Import Lucide React icons
import {
  Folder,
  Music,
  Video,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
  Search,
  Grid,
  List,
  MoreVertical,
  LogOut,
  Shield,
  Plus,
  Star,
  Trash2,
  Download,
  RotateCcw,
  X,
  Clock,
  Users,
  HardDrive,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Interface for File Manager items
interface FileItem {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  size: number; // in bytes
  owner: {
    name: string;
    email: string;
  };
  modifiedAt: string; // ISO String
  createdAt: string; // ISO String
  isStarred: boolean;
  isDeleted: boolean;
  type: "folder" | "audio" | "video" | "image" | "pdf" | "spreadsheet" | "document" | "code" | "other";
  extension?: string;
  blobUrl?: string; // Local Object URL for active previews
}

interface Example {
  message: string;
}

// Pre-seeded Google Drive filesystem based on screenshot
const SEED_FILES: FileItem[] = [
  {
    id: "sfx-folder",
    name: "SFX",
    isFolder: true,
    parentId: null,
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T12:00:00.000Z",
    createdAt: "2026-05-28T12:00:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "projects-folder",
    name: "Projects",
    isFolder: true,
    parentId: null,
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-06-12T10:30:00.000Z",
    createdAt: "2026-06-12T10:30:00.000Z",
    isStarred: true,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "shared-folder",
    name: "Shared Documents",
    isFolder: true,
    parentId: null,
    size: 0,
    owner: { name: "Sarah Connor", email: "sarah@yukthi.net" },
    modifiedAt: "2026-07-01T09:15:00.000Z",
    createdAt: "2026-07-01T09:15:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  // SFX Sub-Folders
  {
    id: "trans-folder",
    name: "TRANSITION - Vocal Cadence (Major_Minor)",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:22:00.000Z",
    createdAt: "2026-05-28T14:22:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "ping-folder",
    name: "Ping Boom Major_Minor",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:23:00.000Z",
    createdAt: "2026-05-28T14:23:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "piano-folder",
    name: "PIANO PINGS",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:25:00.000Z",
    createdAt: "2026-05-28T14:25:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "melody-folder",
    name: "MELODY - Violin Basic (Minor)",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:26:00.000Z",
    createdAt: "2026-05-28T14:26:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "forest-folder",
    name: "Forest (Major Drone)",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:28:00.000Z",
    createdAt: "2026-05-28T14:28:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "drone-folder",
    name: "DRONE - Voice Adrift (Major_Minor)",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:30:00.000Z",
    createdAt: "2026-05-28T14:30:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  {
    id: "atlantic-folder",
    name: "Atlantic Major_Minor",
    isFolder: true,
    parentId: "sfx-folder",
    size: 0,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T14:32:00.000Z",
    createdAt: "2026-05-28T14:32:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "folder"
  },
  // SFX Sub-Files
  {
    id: "file-mp3-1",
    name: "vfs_world-top-3-cinematic-logo-sound-effect-youtube-logo-sound-effect-396897.mp3",
    isFolder: false,
    parentId: "sfx-folder",
    size: 689152, // 673 KB
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T15:10:00.000Z",
    createdAt: "2026-05-28T15:10:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "audio",
    extension: "mp3"
  },
  {
    id: "file-mp4-1",
    name: "Untitled design.mp4",
    isFolder: false,
    parentId: "sfx-folder",
    size: 706560, // 690 KB
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T15:12:00.000Z",
    createdAt: "2026-05-28T15:12:00.000Z",
    isStarred: true,
    isDeleted: false,
    type: "video",
    extension: "mp4"
  },
  {
    id: "file-mp3-2",
    name: "tajuddinahemed-short-logo-intro-sound-clean-transition-stinger-385852.mp3",
    isFolder: false,
    parentId: "sfx-folder",
    size: 194560, // 190 KB
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T15:15:00.000Z",
    createdAt: "2026-05-28T15:15:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "audio",
    extension: "mp3"
  },
  {
    id: "file-mp3-3",
    name: "soundreality-intro-sound-effect-272811.mp3",
    isFolder: false,
    parentId: "sfx-folder",
    size: 576512, // 563 KB
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-05-28T15:17:00.000Z",
    createdAt: "2026-05-28T15:17:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "audio",
    extension: "mp3"
  },
  // Projects Children
  {
    id: "file-pdf-1",
    name: "Website Redesign Scope.pdf",
    isFolder: false,
    parentId: "projects-folder",
    size: 1850000,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-06-12T11:00:00.000Z",
    createdAt: "2026-06-12T11:00:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "pdf",
    extension: "pdf"
  },
  {
    id: "file-sheet-1",
    name: "Q3 Financial Plan.xlsx",
    isFolder: false,
    parentId: "projects-folder",
    size: 520000,
    owner: { name: "Sarah Connor", email: "sarah@yukthi.net" },
    modifiedAt: "2026-07-01T10:00:00.000Z",
    createdAt: "2026-07-01T10:00:00.000Z",
    isStarred: true,
    isDeleted: false,
    type: "spreadsheet",
    extension: "xlsx"
  },
  {
    id: "file-code-1",
    name: "main.tsx",
    isFolder: false,
    parentId: "projects-folder",
    size: 12500,
    owner: { name: "me", email: "me@yukthi.net" },
    modifiedAt: "2026-07-15T18:45:00.000Z",
    createdAt: "2026-07-15T18:45:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "code",
    extension: "tsx"
  },
  // Shared Children
  {
    id: "file-shared-1",
    name: "Company Policy Handbook.pdf",
    isFolder: false,
    parentId: "shared-folder",
    size: 3400000,
    owner: { name: "HR Manager", email: "hr@yukthi.net" },
    modifiedAt: "2026-01-10T08:30:00.000Z",
    createdAt: "2026-01-10T08:30:00.000Z",
    isStarred: false,
    isDeleted: false,
    type: "pdf",
    extension: "pdf"
  }
];

function App() {
  const {
    user,
    token,
    isAuthenticated,
    isLoading: authLoading,
    errorMsg,
    loginWithSso,
    logout,
    clearError,
  } = useAuth();

  // Basic utility verification state
  const [exampleMessage, setExampleMessage] = useState<string>("loading...");
  const [apiResponse, setApiResponse] = useState<string>("");
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [ssoPending, setSsoPending] = useState<boolean>(false);

  // File explorer states
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]); // Folder IDs stack
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeSidebarTab, setActiveSidebarTab] = useState<"drive" | "projects" | "shared" | "recent" | "starred" | "trash" | "system">("drive");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<"name" | "modifiedAt" | "size">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Floating menus & popup modals states
  const [newMenuOpen, setNewMenuOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<"createFolder" | "rename" | "delete" | "logout" | null>(null);
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);
  const [modalInputText, setModalInputText] = useState<string>("");
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check URL parameters for logout confirmation message
  const searchParams = new URLSearchParams(window.location.search);
  const isLogoutParam = searchParams.get("logout") === "true";

  // Auto SSO triggers
  useEffect(() => {
    if (isAuthenticated || authLoading || isLogoutParam) {
      return;
    }

    let active = true;
    const triggerAutoSso = async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!active) return;

      try {
        setSsoPending(true);
        await loginWithSso();
      } catch (err) {
        console.warn("Auto SSO login was blocked or failed", err);
      } finally {
        if (active) {
          setSsoPending(false);
        }
      }
    };

    triggerAutoSso();
    return () => {
      active = false;
    };
  }, [isAuthenticated, authLoading, isLogoutParam]);

  // Load example local asset data
  useEffect(() => {
    getJson<Example>("/example.json")
      .then((data) => setExampleMessage(data.message))
      .catch((err) => setExampleMessage(`error: ${err.message}`));
  }, []);

  // Initialize and load files list
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const stored = localStorage.getItem("yfs_files");
      if (stored) {
        setFiles(JSON.parse(stored));
      } else {
        setFiles(SEED_FILES);
        localStorage.setItem("yfs_files", JSON.stringify(SEED_FILES));
      }
    } catch (err) {
      console.error("Failed to load user filesystem", err);
      setFiles(SEED_FILES);
    }
  }, [isAuthenticated]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
      // If click target isn't the three dots trigger, close the context menu
      if (contextMenuId) {
        const target = e.target as HTMLElement;
        if (!target.closest(".row-actions-trigger") && !target.closest(".context-dropdown")) {
          setContextMenuId(null);
        }
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [contextMenuId]);

  const handleManualLogin = async () => {
    try {
      setSsoPending(true);
      clearError();
      await loginWithSso();
    } catch (err) {
      console.error("Manual SSO login failed", err);
    } finally {
      setSsoPending(false);
    }
  };

  const testAuthenticatedApi = async () => {
    if (!token) return;
    setApiLoading(true);
    setApiResponse("");
    try {
      const data = await getApiJson<any>("/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setApiResponse(`Success: ${JSON.stringify(data)}`);
    } catch (err: any) {
      setApiResponse(`Error: ${err.message || "Failed to query backend API"}`);
    } finally {
      setApiLoading(false);
    }
  };

  // Helper formats
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "-";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper icons mapping using lucide-react
  const getFileIcon = (type: string) => {
    switch (type) {
      case "folder":
        return <Folder className="w-5 h-5 text-yellow-400 fill-yellow-400/20" />;
      case "audio":
        return <Music className="w-5 h-5 text-sky-400" />;
      case "video":
        return <Video className="w-5 h-5 text-rose-500" />;
      case "image":
        return <ImageIcon className="w-5 h-5 text-emerald-500" />;
      case "pdf":
        return <FileText className="w-5 h-5 text-red-500" />;
      case "spreadsheet":
        return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case "document":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "code":
        return <FileCode className="w-5 h-5 text-purple-500" />;
      default:
        return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Directory resolution
  const currentFolderId = currentPath[currentPath.length - 1] || null;

  const navigateToFolder = (folderId: string) => {
    setCurrentPath((prev) => [...prev, folderId]);
    setSelectedItemId(null);
    setSearchQuery("");
  };

  const navigateBackTo = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath((prev) => prev.slice(0, index + 1));
    }
    setSelectedItemId(null);
    setSearchQuery("");
  };

  // File explorer interactions
  const handleItemSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItemId(id === selectedItemId ? null : id);
  };

  const handleCheckboxToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    const listIds = getFilteredItems().map((item) => item.id);
    const allChecked = listIds.every((id) => checkedItemIds.includes(id));
    if (allChecked) {
      setCheckedItemIds((prev) => prev.filter((id) => !listIds.includes(id)));
    } else {
      setCheckedItemIds((prev) => [...new Set([...prev, ...listIds])]);
    }
  };

  // CRUD Actions
  const openCreateFolderModal = () => {
    setModalInputText("");
    setActiveModal("createFolder");
    setNewMenuOpen(false);
  };

  const handleCreateFolder = () => {
    if (!modalInputText.trim()) return;

    // TODO(security): Prevent directory traversal in folder name
    const safeName = modalInputText.replace(/[\/\\]/g, "").replace(/\.\.+/g, "").trim();
    if (!safeName) return;

    const newFolder: FileItem = {
      id: "folder-" + Date.now(),
      name: safeName,
      isFolder: true,
      parentId: currentFolderId,
      size: 0,
      owner: {
        name: user?.username || "me",
        email: user?.email || "me@yukthi.net",
      },
      modifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isStarred: false,
      isDeleted: false,
      type: "folder",
    };

    const updated = [...files, newFolder];
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setActiveModal(null);
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setNewMenuOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const newItems: FileItem[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      // TODO(security): Prevent directory traversal in uploaded filename
      const safeName = file.name.replace(/[\/\\]/g, "").replace(/\.\.+/g, "") || "unnamed";

      let category: FileItem["type"] = "other";
      const mime = file.type.toLowerCase();
      const ext = safeName.split(".").pop()?.toLowerCase() || "";

      if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) {
        category = "audio";
      } else if (mime.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) {
        category = "video";
      } else if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
        category = "image";
      } else if (mime === "application/pdf" || ext === "pdf") {
        category = "pdf";
      } else if (mime.includes("sheet") || mime.includes("excel") || ["xlsx", "xls", "csv"].includes(ext)) {
        category = "spreadsheet";
      } else if (mime.includes("word") || mime.includes("document") || ["docx", "doc", "txt", "rtf"].includes(ext)) {
        category = "document";
      } else if (mime.includes("javascript") || mime.includes("typescript") || mime.includes("json") || ["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "go"].includes(ext)) {
        category = "code";
      }

      // Generate local Object URL for previews
      const blobUrl = URL.createObjectURL(file);

      const newItem: FileItem = {
        id: "file-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        name: safeName,
        isFolder: false,
        parentId: currentFolderId,
        size: file.size,
        owner: {
          name: user?.username || "me",
          email: user?.email || "me@yukthi.net",
        },
        modifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isStarred: false,
        isDeleted: false,
        type: category,
        extension: ext,
        blobUrl: blobUrl,
      };

      newItems.push(newItem);
    }

    const updated = [...files, ...newItems];
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openRenameModal = (itemId: string, currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalTargetId(itemId);
    setModalInputText(currentName);
    setActiveModal("rename");
    setContextMenuId(null);
  };

  const handleRename = () => {
    if (!modalTargetId || !modalInputText.trim()) return;

    // TODO(security): Prevent directory traversal in folder/file name
    const safeName = modalInputText.replace(/[\/\\]/g, "").replace(/\.\.+/g, "").trim();
    if (!safeName) return;

    const updated = files.map((file) => {
      if (file.id === modalTargetId) {
        return {
          ...file,
          name: safeName,
          modifiedAt: new Date().toISOString(),
        };
      }
      return file;
    });

    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setActiveModal(null);
    setModalTargetId(null);
  };

  const toggleStar = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = files.map((file) => {
      if (file.id === itemId) {
        return { ...file, isStarred: !file.isStarred };
      }
      return file;
    });
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setContextMenuId(null);
  };

  const openTrashModal = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalTargetId(itemId);
    setActiveModal("delete");
    setContextMenuId(null);
  };

  const handleTrashItem = () => {
    if (!modalTargetId) return;

    const updated = files.map((file) => {
      if (file.id === modalTargetId) {
        return { ...file, isDeleted: true };
      }
      return file;
    });

    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setActiveModal(null);
    setModalTargetId(null);
    setSelectedItemId(null);
  };

  const handleRestoreItem = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = files.map((file) => {
      if (file.id === itemId) {
        return { ...file, isDeleted: false };
      }
      return file;
    });
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setContextMenuId(null);
  };

  const handlePermanentDelete = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = files.filter((file) => file.id !== itemId);
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setSelectedItemId(null);
    setContextMenuId(null);
  };

  // Batch operations
  const handleBatchTrash = () => {
    const updated = files.map((file) => {
      if (checkedItemIds.includes(file.id)) {
        return { ...file, isDeleted: true };
      }
      return file;
    });
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setCheckedItemIds([]);
    setSelectedItemId(null);
  };

  const handleBatchRestore = () => {
    const updated = files.map((file) => {
      if (checkedItemIds.includes(file.id)) {
        return { ...file, isDeleted: false };
      }
      return file;
    });
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setCheckedItemIds([]);
  };

  const handleBatchStar = () => {
    const updated = files.map((file) => {
      if (checkedItemIds.includes(file.id)) {
        return { ...file, isStarred: true };
      }
      return file;
    });
    setFiles(updated);
    localStorage.setItem("yfs_files", JSON.stringify(updated));
    setCheckedItemIds([]);
  };

  // Download simulation
  const handleDownload = (item: FileItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (item.isFolder) return;

    if (item.blobUrl) {
      const link = document.createElement("a");
      link.href = item.blobUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Simulate download for seeded files
      const blob = new Blob([`Seeded File: ${item.name}\nSize: ${item.size} bytes`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setContextMenuId(null);
  };

  // Filtering and Sorting
  const getFilteredItems = (): FileItem[] => {
    let result = [...files];

    // Sidebar view filter
    if (activeSidebarTab === "drive") {
      result = result.filter((file) => file.parentId === currentFolderId && !file.isDeleted);
    } else if (activeSidebarTab === "projects") {
      result = result.filter((file) => file.parentId === "projects-folder" && !file.isDeleted);
    } else if (activeSidebarTab === "shared") {
      result = result.filter((file) => file.parentId === "shared-folder" && !file.isDeleted);
    } else if (activeSidebarTab === "recent") {
      result = result.filter((file) => !file.isFolder && !file.isDeleted);
    } else if (activeSidebarTab === "starred") {
      result = result.filter((file) => file.isStarred && !file.isDeleted);
    } else if (activeSidebarTab === "trash") {
      result = result.filter((file) => file.isDeleted);
    }

    // Search query filter (searches globally)
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((file) => file.name.toLowerCase().includes(query) && !file.isDeleted);
    }

    // Type filter
    if (typeFilter !== "all" && activeSidebarTab !== "trash") {
      result = result.filter((file) => file.type === typeFilter);
    }

    // Apply Sorting
    result.sort((a, b) => {
      // Folders always go first
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "modifiedAt") {
        comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      } else if (sortField === "size") {
        comparison = a.size - b.size;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    // Limit recent items to top 15
    if (activeSidebarTab === "recent" && searchQuery.trim() === "") {
      result = result.slice(0, 15);
    }

    return result;
  };

  const getBreadcrumbSegments = () => {
    const segments = [{ id: null, name: "My Drive" }];
    currentPath.forEach((folderId) => {
      const folder = files.find((f) => f.id === folderId);
      if (folder) {
        segments.push({ id: folderId as any, name: folder.name });
      }
    });
    return segments;
  };

  // Storage utilization calculation
  const totalStorageAllocated = (user?.quota_allocated || 5120) * 1024 * 1024; // Convert MB to Bytes (default 5 GB)
  const totalStorageUtilized = files
    .filter((f) => !f.isDeleted && !f.isFolder)
    .reduce((sum, f) => sum + f.size, 0) + ((user?.quota_utilized || 0) * 1024 * 1024);

  const storagePercentage = Math.min((totalStorageUtilized / totalStorageAllocated) * 100, 100);

  // Authenticated state loading check
  if (authLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg-main">
        <div className="w-full max-w-md bg-bg-main/70 backdrop-blur-md border border-border-main rounded-3xl p-10 shadow-lg text-center">
          <div className="w-8 h-8 border-3 border-border-main border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-main font-medium">Restoring secure session...</p>
        </div>
      </div>
    );
  }

  // 1. Unauthenticated Login screen
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center p-6 bg-gradient-to-tr from-indigo-500/5 via-transparent to-accent/5">
        <div className="w-full max-w-md bg-bg-main/75 backdrop-blur-lg border border-border-main rounded-3xl p-10 shadow-lg text-center hover:-translate-y-0.5 transition-all duration-300">
          <div className="inline-flex items-center justify-center w-15 h-15 bg-accent-bg border border-accent-border rounded-2xl text-accent mb-6 text-3xl">
            🛡️
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-heading mb-2">YFS</h1>
          <p className="text-text-main text-sm leading-relaxed mb-8">
            Access your secure organization workspace and tools using Single Sign-On (SSO).
          </p>

          {errorMsg ? (
            <div className="flex gap-3 text-left bg-red-500/5 border border-red-500/20 text-red-500 p-4 rounded-2xl text-xs leading-normal mb-6">
              <div>
                <strong className="font-semibold text-red-600 block mb-0.5">Authentication Notice</strong>
                <p>{errorMsg}</p>
              </div>
            </div>
          ) : ssoPending ? (
            <div className="flex gap-3 text-left bg-accent-bg border border-accent-border text-text-heading p-4 rounded-2xl text-xs leading-normal mb-6">
              <div>
                <strong className="font-semibold text-accent block mb-0.5">SSO Authentication Active</strong>
                <p>Please complete the login verification in the opened SSO window.</p>
              </div>
            </div>
          ) : null}

          {ssoPending && (
            <div className="w-8 h-8 border-3 border-border-main border-t-accent rounded-full animate-spin mx-auto mb-6"></div>
          )}

          <button
            onClick={handleManualLogin}
            disabled={ssoPending}
            className="flex items-center justify-center w-full py-3.5 px-6 rounded-2xl bg-gradient-to-br from-accent to-purple-600 text-white font-semibold shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-border-main disabled:text-text-main disabled:shadow-none disabled:transform-none cursor-pointer transition-all"
          >
            {ssoPending ? "Awaiting SSO Verification..." : "Continue with Yukthi SSO"}
          </button>

          {isLogoutParam && (
            <p className="text-xs text-text-main mt-6">
              You have been logged out successfully.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Selected item metrics
  const selectedItem = files.find((f) => f.id === selectedItemId);

  // Resolve directory tree path of selected item
  const getSelectedItemPath = (item: FileItem): string => {
    const path: string[] = [];
    let current = item;
    while (current && current.parentId) {
      const parent = files.find((f) => f.id === current.parentId);
      if (parent) {
        path.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }
    path.unshift("My Drive");
    return path.join(" > ");
  };

  // Avatar initials
  const userInitials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "US";

  const listItems = getFilteredItems();

  // Render media visual elements in right drawer
  const renderPreview = (item: FileItem) => {
    if (item.isFolder) {
      return (
        <div className="flex flex-col items-center gap-2 text-center text-text-main">
          <Folder className="w-12 h-12 text-yellow-400/80 fill-yellow-400/10" />
          <div className="text-xs font-medium">Folder containing directory contents</div>
        </div>
      );
    }

    if (item.type === "image") {
      return (
        <img
          src={item.blobUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='1'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>"}
          alt={item.name}
          className="max-w-full max-h-[160px] object-contain rounded-lg shadow-sm"
        />
      );
    }

    if (item.type === "audio") {
      return (
        <div className="flex flex-col items-center gap-4 w-full px-2">
          <div className="flex items-end gap-1.5 h-10">
            <div className="w-1 h-3 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate]"></div>
            <div className="w-1 h-5 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.2s]"></div>
            <div className="w-1 h-8 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.4s]"></div>
            <div className="w-1 h-6 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.1s]"></div>
            <div className="w-1 h-4 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.3s]"></div>
            <div className="w-1 h-2 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.5s]"></div>
          </div>
          {item.blobUrl ? (
            <audio src={item.blobUrl} controls className="w-full h-8 outline-none" />
          ) : (
            <div className="text-xs text-text-main text-center">Seeded audio track. Download to play.</div>
          )}
        </div>
      );
    }

    if (item.type === "video") {
      if (item.blobUrl) {
        return <video src={item.blobUrl} controls className="w-full max-h-[160px] rounded-lg outline-none shadow-sm" />;
      }
      return (
        <div className="flex flex-col items-center gap-2 text-center text-text-main">
          <Video className="w-12 h-12 text-rose-400" />
          <div className="text-xs font-medium">Seeded video. Download to play.</div>
        </div>
      );
    }

    if (item.type === "pdf") {
      return (
        <div className="flex flex-col items-center gap-2 text-center text-text-main">
          <FileText className="w-12 h-12 text-red-400" />
          <div className="text-xs font-medium">PDF Document. Download to read.</div>
        </div>
      );
    }

    if (item.type === "spreadsheet") {
      return (
        <div className="w-full text-left text-[11px] font-mono border border-border-main rounded-md overflow-hidden bg-bg-main shadow-inner">
          <div className="grid grid-cols-3 gap-0.5 bg-border-main p-0.5">
            <div className="bg-code-bg p-1 font-bold text-center">A</div>
            <div className="bg-code-bg p-1 font-bold text-center">B</div>
            <div className="bg-code-bg p-1 font-bold text-center">C</div>
            <div className="bg-bg-main p-1.5">Revenue</div>
            <div className="bg-bg-main p-1.5 text-right">$12,450</div>
            <div className="bg-bg-main p-1.5 text-center text-green-600">Q3</div>
            <div className="bg-bg-main p-1.5">Expenses</div>
            <div className="bg-bg-main p-1.5 text-right">$4,120</div>
            <div className="bg-bg-main p-1.5 text-center text-red-500">Tax</div>
          </div>
        </div>
      );
    }

    if (item.type === "code") {
      return (
        <div className="w-full text-left text-[10px] font-mono bg-neutral-900 text-neutral-300 p-3 rounded-lg overflow-x-auto max-h-[140px] shadow-sm">
          <pre>
            <code>{`// React file explorer\nimport React from "react";\n\nexport const FolderView = () => {\n  return <div>Tree Explorer</div>;\n}`}</code>
          </pre>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main">
        <FileIcon className="w-12 h-12 text-neutral-400" />
        <div className="text-xs font-medium">{item.extension?.toUpperCase() || "Unknown"} Document</div>
      </div>
    );
  };

  return (
    <div className="flex w-screen h-screen bg-bg-main text-text-main overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={`bg-bg-main border-r border-border-main flex flex-col justify-between p-6 box-border shrink-0 transition-all duration-300 max-[768px]:w-full max-[768px]:h-auto max-[768px]:border-r-0 max-[768px]:border-b ${sidebarCollapsed ? "w-20 min-w-[80px]" : "w-70 min-w-[280px]"}`}>
        <div className="flex flex-col gap-6 max-[768px]:gap-4">
          <div className={`flex items-center gap-3 px-2 py-2 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl text-accent flex items-center justify-center">⚡</span>
              {!sidebarCollapsed && <span className="text-xl font-bold text-text-heading tracking-tight">YFS</span>}
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="border-none bg-transparent p-1.5 rounded-lg cursor-pointer text-text-main hover:bg-code-bg flex items-center justify-center transition max-[768px]:hidden"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* New Actions Dropdown */}
          <div className="relative w-full flex justify-center" ref={dropdownRef}>
            <button
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              className={`flex items-center justify-center bg-bg-main border border-border-main rounded-2xl shadow-sm hover:bg-code-bg active:translate-y-0 hover:-translate-y-0.5 text-text-heading font-semibold cursor-pointer transition-all duration-200 ${sidebarCollapsed ? "w-12 h-12 rounded-full p-0" : "gap-2 w-36 py-3 px-5"}`}
              title={sidebarCollapsed ? "New" : undefined}
            >
              <Plus className="w-5 h-5 text-accent" strokeWidth={2.5} />
              {!sidebarCollapsed && <span>New</span>}
            </button>
            {newMenuOpen && (
              <div className={`absolute z-50 w-48 bg-bg-main border border-border-main rounded-xl p-1.5 shadow-md flex flex-col gap-0.5 animate-scale-in ${sidebarCollapsed ? "top-0 left-full ml-2" : "top-[calc(100%+8px)] left-0"}`}>
                <button onClick={openCreateFolderModal} className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150">
                  <Folder className="w-4 h-4" /> Create Folder
                </button>
                <button onClick={triggerFileUpload} className="flex items-center gap-3 px-3.5 py-2.5 border-none bg-transparent text-text-main rounded-lg text-sm font-medium text-left cursor-pointer hover:bg-accent-bg hover:text-accent transition duration-150">
                  <Plus className="w-4 h-4 rotate-45" /> Upload File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  multiple
                />
              </div>
            )}
          </div>

          {/* Sidebar navigation list */}
          <nav>
            <ul className="flex flex-col gap-1 p-0 m-0 list-none max-[768px]:flex-row max-[768px]:flex-wrap">
              <li
                onClick={() => {
                  setActiveSidebarTab("drive");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${activeSidebarTab === "drive" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "My Drive" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Folder className="w-4 h-4" />
                  {!sidebarCollapsed && <span>My Drive</span>}
                </span>
              </li>
              <li
                onClick={() => {
                  setActiveSidebarTab("projects");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${activeSidebarTab === "projects" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "Projects" : undefined}
              >
                <span className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Projects</span>}
                </span>
              </li>
              <li
                onClick={() => {
                  setActiveSidebarTab("shared");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${activeSidebarTab === "shared" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "Shared" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Users className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Shared</span>}
                </span>
              </li>
              <li
                onClick={() => {
                  setActiveSidebarTab("recent");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${activeSidebarTab === "recent" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "Recent" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Clock className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Recent</span>}
                </span>
              </li>
              <li
                onClick={() => {
                  setActiveSidebarTab("starred");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${activeSidebarTab === "starred" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "Starred" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Star className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Starred</span>}
                </span>
              </li>
              <li
                onClick={() => {
                  setActiveSidebarTab("trash");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading ${activeSidebarTab === "trash" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "Trash" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Trash2 className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Trash</span>}
                </span>
              </li>
              <li
                onClick={() => {
                  setActiveSidebarTab("system");
                  setSelectedItemId(null);
                }}
                className={`flex items-center rounded-xl text-text-main font-medium text-[0.95rem] cursor-pointer transition hover:bg-code-bg hover:text-text-heading border-t border-border-main mt-4 pt-4 max-[768px]:mt-0 max-[768px]:pt-3 ${activeSidebarTab === "system" ? "bg-accent-bg text-accent font-semibold" : ""} ${sidebarCollapsed ? "justify-center p-3" : "justify-between px-4 py-3"}`}
                title={sidebarCollapsed ? "Workspace & System" : undefined}
              >
                <span className="flex items-center gap-3">
                  <Shield className="w-4 h-4" />
                  {!sidebarCollapsed && <span>Workspace & System</span>}
                </span>
              </li>
            </ul>
          </nav>
        </div>

        {/* Sidebar storage tracker widget and profile details */}
        <div className="flex flex-col gap-5 max-[768px]:hidden">
          {!sidebarCollapsed && (
            <div className="bg-code-bg p-4 rounded-2xl border border-border-main text-xs">
              <div className="flex justify-between font-semibold text-text-heading mb-1.5">
                <span>Storage</span>
                <span>{Math.round(storagePercentage)}% Used</span>
              </div>
              <div className="w-full h-1.5 bg-border-main rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${storagePercentage}%` }}
                ></div>
              </div>
              <span className="text-text-main text-[11px]">
                {formatBytes(totalStorageUtilized)} of {formatBytes(totalStorageAllocated)} used
              </span>
            </div>
          )}

          <div className={`flex items-center justify-between border-t border-border-main ${sidebarCollapsed ? "pt-4 justify-center" : "pt-4"}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-accent to-indigo-500 text-white flex items-center justify-center font-bold text-sm">
                {userInitials}
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col overflow-hidden text-left animate-fade-in">
                  <span className="text-sm font-semibold text-text-heading truncate">{capitalize(user?.username || "Guest User")}</span>
                  <span className="text-[11px] text-text-main truncate">{user?.email}</span>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={() => setActiveModal("logout")}
                className="border-none bg-transparent p-2 rounded-lg cursor-pointer text-text-main hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN PANEL */}
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-main">
        
        {/* TOP BAR / SEARCH */}
        <header className="h-[70px] min-h-[70px] border-b border-border-main px-8 flex items-center justify-between gap-8 box-border max-[768px]:px-4">
          {activeSidebarTab !== "system" ? (
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main pointer-events-none" />
              <input
                type="text"
                placeholder="Search files and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2.5 pl-11 pr-4 rounded-full border border-border-main bg-code-bg text-text-heading text-sm transition focus:outline-none focus:border-accent focus:bg-bg-main focus:ring-4 focus:ring-accent-bg"
              />
            </div>
          ) : (
            <div className="font-semibold text-lg text-text-heading">System Dashboard</div>
          )}

          <div className="flex items-center gap-2">
            {activeSidebarTab !== "system" && (
              <>
                <button
                  onClick={() => setViewMode("list")}
                  className={`w-9 h-9 flex items-center justify-center rounded-full text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition ${viewMode === "list" ? "bg-accent-bg text-accent! border border-accent-border!" : ""}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`w-9 h-9 flex items-center justify-center rounded-full text-text-main hover:bg-code-bg hover:text-text-heading cursor-pointer transition ${viewMode === "grid" ? "bg-accent-bg text-accent! border border-accent-border!" : ""}`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {activeSidebarTab === "system" ? (
            // 2a. System Details view (original auth dashboard elements)
            <div className="flex-1 overflow-y-auto px-8 py-6 pb-12 flex flex-col gap-6 text-left max-[768px]:px-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-text-heading">Organization Details</h2>
                <p className="text-sm text-text-main">Secure workspace account details retrieved via single sign-on.</p>
              </div>

              <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-main font-medium uppercase tracking-wider">Organization Name</span>
                    <span className="text-base font-semibold text-text-heading">{user?.organization_name || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-main font-medium uppercase tracking-wider">Workspace Domain</span>
                    <span className="text-base font-semibold text-text-heading">{user?.domain_name || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-main font-medium uppercase tracking-wider">Quota Allocation</span>
                    <span className="text-base font-semibold text-text-heading">
                      {user?.quota_utilized !== undefined && user?.quota_allocated !== undefined
                        ? `${user.quota_utilized} MB / ${user.quota_allocated} MB`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-main font-medium uppercase tracking-wider">File Sharing Status</span>
                    <span className="text-base font-semibold text-text-heading">{user?.enable_file_sharing ? "Enabled ✅" : "Disabled ❌"}</span>
                  </div>
                </div>
              </div>

              {/* API verification */}
              <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
                <h3 className="text-base font-bold text-text-heading mb-1.5">Backend API Verification</h3>
                <p className="text-sm text-text-main mb-4 leading-relaxed">
                  Execute requests against the local backend server passing the current JWT token.
                </p>
                <button
                  onClick={testAuthenticatedApi}
                  disabled={apiLoading}
                  className="flex items-center justify-center w-fit py-2.5 px-5 bg-gradient-to-br from-accent to-purple-600 text-white font-semibold rounded-xl hover:shadow-md cursor-pointer transition-all"
                >
                  {apiLoading ? "Verifying Session..." : "Verify API Session"}
                </button>

                {apiResponse && (
                  <div className="mt-4">
                    <span className="text-xs text-text-main font-medium uppercase tracking-wider">Response Data</span>
                    <pre className="max-w-full overflow-x-auto text-[11px] font-mono leading-relaxed bg-bg-main p-3 rounded-lg border border-border-main whitespace-pre-wrap break-all mt-1">
                      <code>{apiResponse}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Security token */}
              <div className="bg-code-bg p-6 rounded-2xl border border-border-main">
                <h3 className="text-base font-bold text-text-heading mb-1.5">Active Authentication token</h3>
                <div className="max-w-full overflow-x-auto text-[11px] font-mono leading-relaxed bg-bg-main p-3 rounded-lg border border-border-main whitespace-pre-wrap break-all">
                  <code>{token}</code>
                </div>
              </div>

              {/* Local Packages Check */}
              <div className="border-t border-border-main pt-4 flex flex-col gap-2">
                <p className="text-sm text-text-main">
                  <strong>Local Utility check:</strong> slugified name: <code className="bg-code-bg px-1.5 py-0.5 rounded text-text-heading">{slugify(user?.username || "")}</code> | mock currency: <code className="bg-code-bg px-1.5 py-0.5 rounded text-text-heading">{formatCurrency(1999)}</code>
                </p>
                <p className="text-sm text-text-main">
                  <strong>Local Shared Package (service fetch):</strong> <code className="bg-code-bg px-1.5 py-0.5 rounded text-text-heading">{exampleMessage}</code>
                </p>
                <p className="text-xs text-neutral-400">
                  API Base URL Configured: <code>{API_BASE_URL || "(Not defined)"}</code>
                </p>
              </div>
            </div>
          ) : (
            // 2b. Main File Explorer View
            <div className="flex-1 overflow-y-auto px-8 py-6 pb-12 flex flex-col gap-6 max-[768px]:px-4" onClick={() => setSelectedItemId(null)}>
              
              {/* Breadcrumbs / Path navigation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-wrap gap-1 text-lg font-medium text-text-main">
                  {getBreadcrumbSegments().map((seg, idx) => {
                    const isLast = idx === getBreadcrumbSegments().length - 1;
                    return (
                      <span key={idx} className="inline-flex items-center">
                        {idx > 0 && <span className="text-border-main px-1 text-sm">/</span>}
                        <span
                          onClick={() => !isLast && navigateBackTo(idx - 1)}
                          className={`hover:text-accent cursor-pointer transition ${isLast ? "text-text-heading font-semibold cursor-default hover:text-text-heading!" : ""}`}
                        >
                          {seg.name}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Filters / Multi-Selection actions bar */}
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border-main pb-3" onClick={(e) => e.stopPropagation()}>
                {checkedItemIds.length > 0 ? (
                  <div className="flex items-center gap-3 bg-accent-bg border border-accent-border px-3.5 py-1.5 rounded-xl animate-fade-in">
                    <span className="text-xs font-semibold text-accent">{checkedItemIds.length} selected</span>
                    {activeSidebarTab === "trash" ? (
                      <>
                        <button onClick={handleBatchRestore} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition">
                          Restore
                        </button>
                        <button
                          onClick={() => {
                            checkedItemIds.forEach((id) => handlePermanentDelete(id));
                            setCheckedItemIds([]);
                          }}
                          className="text-xs bg-transparent border-none text-red-500 hover:bg-red-500/10 py-1 px-2 rounded font-medium cursor-pointer transition"
                        >
                          Delete Permanent
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={handleBatchStar} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition">
                          ★ Star
                        </button>
                        <button onClick={handleBatchTrash} className="text-xs bg-transparent border-none text-red-500 hover:bg-red-500/10 py-1 px-2 rounded font-medium cursor-pointer transition">
                          🗑️ Move to Trash
                        </button>
                      </>
                    )}
                    <button onClick={() => setCheckedItemIds([])} className="text-xs bg-transparent border-none text-text-heading hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded font-medium cursor-pointer transition ml-2">
                      ✕ Clear
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setTypeFilter("all")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "all" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      All Types
                    </button>
                    <button
                      onClick={() => setTypeFilter("audio")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "audio" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      Audio
                    </button>
                    <button
                      onClick={() => setTypeFilter("video")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "video" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      Video
                    </button>
                    <button
                      onClick={() => setTypeFilter("image")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "image" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      Images
                    </button>
                    <button
                      onClick={() => setTypeFilter("pdf")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "pdf" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      PDFs
                    </button>
                    <button
                      onClick={() => setTypeFilter("spreadsheet")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "spreadsheet" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      Sheets
                    </button>
                    <button
                      onClick={() => setTypeFilter("code")}
                      className={`px-3.5 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main hover:text-text-heading transition ${typeFilter === "code" ? "bg-accent! text-white! border-accent!" : ""}`}
                    >
                      Code
                    </button>
                  </div>
                )}

                {/* Sort selector dropdown controls */}
                <div className="flex gap-2">
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as any)}
                    className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer focus:outline-none"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="modifiedAt">Sort by Modified</option>
                    <option value="size">Sort by Size</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="px-3 py-1.5 bg-code-bg border border-border-main rounded-full text-xs font-medium text-text-main cursor-pointer hover:bg-border-main transition"
                    title="Toggle Sort Direction"
                  >
                    {sortOrder === "asc" ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {/* EMPTY PLACEHOLDER */}
              {listItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4 text-text-main">
                  <Folder className="w-14 h-14 mb-4 opacity-50 text-neutral-400" />
                  <div className="text-base font-semibold text-text-heading mb-1.5">Folder is Empty</div>
                  <div className="text-sm max-w-[320px] leading-relaxed">
                    There are no files here. Create a new folder or upload files using the "+ New" button.
                  </div>
                </div>
              ) : viewMode === "list" ? (
                // 3a. FILES LIST TABLE LAYOUT
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider w-10 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={
                              listItems.length > 0 &&
                              listItems.every((item) => checkedItemIds.includes(item.id))
                            }
                            onChange={handleSelectAllToggle}
                          />
                        </th>
                        <th className="px-4 py-3 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider">Owner</th>
                        <th className="px-4 py-3 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider">Last Modified</th>
                        <th className="px-4 py-3 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider">Size</th>
                        <th className="px-4 py-3 border-b border-border-main text-text-main text-[11px] font-semibold uppercase tracking-wider w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {listItems.map((item) => {
                        const isSel = selectedItemId === item.id;
                        const isChecked = checkedItemIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            className={`cursor-pointer transition duration-150 ${isSel ? "bg-accent-bg!" : "hover:bg-code-bg"}`}
                            onClick={(e) => handleItemSelect(item.id, e)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (item.isFolder) {
                                navigateToFolder(item.id);
                              }
                            }}
                          >
                            <td className="px-4 py-3 border-b border-border-main text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleCheckboxToggle(item.id, e as any)}
                              />
                            </td>
                            <td className="px-4 py-3 border-b border-border-main">
                              <div className="flex items-center gap-3 font-medium text-text-heading overflow-hidden whitespace-nowrap">
                                {getFileIcon(item.type)}
                                <span className="truncate">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 border-b border-border-main">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                                  {item.owner.name.substring(0, 1).toUpperCase()}
                                </div>
                                <span className="text-xs text-text-heading font-medium">{item.owner.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 border-b border-border-main text-xs text-text-main">
                              {formatDate(item.modifiedAt)}
                            </td>
                            <td className="px-4 py-3 border-b border-border-main text-xs text-text-main">
                              {formatBytes(item.size)}
                            </td>
                            <td className="px-4 py-3 border-b border-border-main text-center relative" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setContextMenuId(contextMenuId === item.id ? null : item.id)}
                                className="border-none bg-transparent p-1.5 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {contextMenuId === item.id && (
                                <div className="absolute right-4 top-full mt-1.5 z-50 w-40 bg-bg-main border border-border-main rounded-xl p-1 shadow-md flex flex-col gap-0.5 animate-scale-in">
                                  {item.isFolder ? null : (
                                    <button onClick={(e) => handleDownload(item, e)} className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition">
                                      <Download className="w-3.5 h-3.5" /> Download
                                    </button>
                                  )}
                                  <button onClick={(e) => toggleStar(item.id, e)} className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition">
                                    <Star className={`w-3.5 h-3.5 ${item.isStarred ? "text-yellow-400 fill-yellow-400" : ""}`} /> {item.isStarred ? "Unstar" : "Star"}
                                  </button>
                                  <button
                                    onClick={(e) => openRenameModal(item.id, item.name, e)}
                                    className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition"
                                  >
                                    ✏️ Rename
                                  </button>
                                  {item.isDeleted ? (
                                    <>
                                      <button onClick={(e) => handleRestoreItem(item.id, e)} className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition">
                                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                                      </button>
                                      <button
                                        onClick={(e) => handlePermanentDelete(item.id, e)}
                                        className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition"
                                      >
                                        ✕ Delete Perm
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={(e) => openTrashModal(item.id, e)}
                                      className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                // 3b. FILES GRID LAYOUT
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5" onClick={(e) => e.stopPropagation()}>
                  {listItems.map((item) => {
                    const isSel = selectedItemId === item.id;
                    const isChecked = checkedItemIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={(e) => handleItemSelect(item.id, e)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (item.isFolder) navigateToFolder(item.id);
                        }}
                        className={`group relative bg-bg-main border border-border-main rounded-2xl p-4 cursor-pointer flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-sm ${isSel ? "bg-accent-bg! border-accent!" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleCheckboxToggle(item.id, e as any)}
                            className={`opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 ${isChecked ? "opacity-100!" : ""}`}
                          />
                          <div className="relative">
                            <button
                              onClick={() => setContextMenuId(contextMenuId === item.id ? null : item.id)}
                              className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-text-heading cursor-pointer inline-flex items-center justify-center transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {contextMenuId === item.id && (
                              <div className="absolute right-0 top-full mt-1.5 z-50 w-40 bg-bg-main border border-border-main rounded-xl p-1 shadow-md flex flex-col gap-0.5 animate-scale-in">
                                {item.isFolder ? null : (
                                  <button onClick={(e) => handleDownload(item, e)} className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition">
                                    <Download className="w-3.5 h-3.5" /> Download
                                  </button>
                                )}
                                <button onClick={(e) => toggleStar(item.id, e)} className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition">
                                  <Star className={`w-3.5 h-3.5 ${item.isStarred ? "text-yellow-400 fill-yellow-400" : ""}`} /> {item.isStarred ? "Unstar" : "Star"}
                                </button>
                                <button
                                  onClick={(e) => openRenameModal(item.id, item.name, e)}
                                  className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition"
                                >
                                  ✏️ Rename
                                </button>
                                {item.isDeleted ? (
                                  <>
                                    <button onClick={(e) => handleRestoreItem(item.id, e)} className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-text-main rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-code-bg hover:text-text-heading transition">
                                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                                    </button>
                                    <button
                                      onClick={(e) => handlePermanentDelete(item.id, e)}
                                      className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition"
                                    >
                                      ✕ Delete Perm
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={(e) => openTrashModal(item.id, e)}
                                    className="flex items-center gap-2.5 px-3 py-2 border-none bg-transparent text-red-500 rounded-lg text-xs font-semibold text-left cursor-pointer hover:bg-red-500/10 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-center py-2">
                          {getFileIcon(item.type)}
                        </div>

                        <div className="flex flex-col gap-0.5 text-center mt-2">
                          <span className="text-xs font-semibold text-text-heading truncate w-full px-1">{item.name}</span>
                          <span className="text-[10px] text-text-main">
                            {item.isFolder ? "Directory" : formatBytes(item.size)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* RIGHT SIDE DETAILS PANEL DRAWER */}
          {selectedItem && activeSidebarTab !== "system" && (
            <aside className="w-90 min-w-[360px] border-l border-border-main bg-bg-main flex flex-col h-full overflow-y-auto box-border shrink-0 max-[1024px]:absolute max-[1024px]:right-0 max-[1024px]:top-0 max-[1024px]:bottom-0 max-[1024px]:z-40 max-[1024px]:shadow-xl animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4.5 border-b border-border-main flex items-center justify-between">
                <h3 className="text-base font-bold text-text-heading">Details</h3>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-code-bg text-text-main hover:text-text-heading border-none bg-transparent cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-6 text-left">
                {/* Media Preview Container */}
                <div className="w-full rounded-xl bg-code-bg border border-border-main overflow-hidden flex flex-col items-center justify-center min-h-40 p-4 box-border relative">
                  {renderPreview(selectedItem)}
                </div>

                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-bold text-text-heading break-all leading-snug">
                    {selectedItem.name}
                  </h4>
                  <span className="text-xs text-text-main">
                    Type: {selectedItem.isFolder ? "Folder" : selectedItem.extension?.toUpperCase() || selectedItem.type}
                  </span>
                </div>

                {/* Metadata Properties */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between text-xs leading-normal">
                    <span className="text-text-main font-semibold">Owner</span>
                    <span className="text-text-heading font-medium truncate max-w-[60%]">{selectedItem.owner.name}</span>
                  </div>
                  <div className="flex justify-between text-xs leading-normal">
                    <span className="text-text-main font-semibold">Location</span>
                    <span className="text-text-heading font-medium truncate max-w-[60%]" title={getSelectedItemPath(selectedItem)}>
                      {getSelectedItemPath(selectedItem)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs leading-normal">
                    <span className="text-text-main font-semibold">Size</span>
                    <span className="text-text-heading font-medium">{formatBytes(selectedItem.size)}</span>
                  </div>
                  <div className="flex justify-between text-xs leading-normal">
                    <span className="text-text-main font-semibold">Modified</span>
                    <span className="text-text-heading font-medium">{formatDate(selectedItem.modifiedAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs leading-normal">
                    <span className="text-text-main font-semibold">Created</span>
                    <span className="text-text-heading font-medium">{formatDate(selectedItem.createdAt)}</span>
                  </div>
                </div>

                {/* Quick actions inside details drawer */}
                <div className="flex flex-col gap-2 mt-2">
                  {selectedItem.isFolder ? null : (
                    <button
                      onClick={() => handleDownload(selectedItem)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-br from-accent to-purple-600 text-white font-semibold rounded-xl hover:shadow-md cursor-pointer transition-all"
                    >
                      <Download className="w-4 h-4" /> Download File
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleStar(selectedItem.id)}
                      className="flex-1 py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
                    >
                      <Star className={`w-3.5 h-3.5 ${selectedItem.isStarred ? "text-yellow-400 fill-yellow-400" : ""}`} /> {selectedItem.isStarred ? "Unstar" : "Star"}
                    </button>
                    <button
                      onClick={() => openRenameModal(selectedItem.id, selectedItem.name)}
                      className="flex-1 py-2.5 bg-transparent border border-border-main text-text-heading font-semibold rounded-xl hover:bg-code-bg cursor-pointer transition text-xs"
                    >
                      Rename
                    </button>
                  </div>
                  {selectedItem.isDeleted ? (
                    <button
                      onClick={() => handleRestoreItem(selectedItem.id)}
                      className="w-full py-2.5 bg-transparent border border-green-500/50 text-green-600 font-semibold rounded-xl hover:bg-green-500/10 cursor-pointer transition text-xs"
                    >
                      Restore Item
                    </button>
                  ) : (
                    <button
                      onClick={() => openTrashModal(selectedItem.id)}
                      className="w-full py-2.5 bg-transparent border border-red-500/50 text-red-500 font-semibold rounded-xl hover:bg-red-500/10 cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Move to Trash
                    </button>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* POPUP ACTION MODAL DIALOGS */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {activeModal === "createFolder" && (
              <>
                <h3 className="modal-title">New Folder</h3>
                <div className="dialog-form-group">
                  <label className="data-label">Folder Name</label>
                  <input
                    type="text"
                    value={modalInputText}
                    onChange={(e) => setModalInputText(e.target.value)}
                    placeholder="Enter folder name"
                    className="dialog-input"
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button onClick={() => setActiveModal(null)} className="btn-outline">
                    Cancel
                  </button>
                  <button onClick={handleCreateFolder} className="btn-primary" style={{ width: "auto" }}>
                    Create Folder
                  </button>
                </div>
              </>
            )}

            {activeModal === "rename" && (
              <>
                <h3 className="modal-title">Rename Item</h3>
                <div className="dialog-form-group">
                  <label className="data-label">New Name</label>
                  <input
                    type="text"
                    value={modalInputText}
                    onChange={(e) => setModalInputText(e.target.value)}
                    className="dialog-input"
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button onClick={() => setActiveModal(null)} className="btn-outline">
                    Cancel
                  </button>
                  <button onClick={handleRename} className="btn-primary" style={{ width: "auto" }}>
                    Rename
                  </button>
                </div>
              </>
            )}

            {activeModal === "delete" && (
              <>
                <h3 className="modal-title">Move to Trash</h3>
                <p className="modal-description">
                  Are you sure you want to move this item to the Trash? You can restore it later from the Trash tab.
                </p>
                <div className="modal-actions">
                  <button onClick={() => setActiveModal(null)} className="btn-outline">
                    Cancel
                  </button>
                  <button onClick={handleTrashItem} className="btn-destructive">
                    Move to Trash
                  </button>
                </div>
              </>
            )}

            {activeModal === "logout" && (
              <>
                <h3 className="modal-title">Logout Confirmation</h3>
                <p className="modal-description">
                  Are you sure you want to logout? You will need to login again to access the workspace.
                </p>
                <div className="modal-actions">
                  <button onClick={() => setActiveModal(null)} className="btn-outline">
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setActiveModal(null);
                      await logout();
                    }}
                    className="btn-destructive"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
