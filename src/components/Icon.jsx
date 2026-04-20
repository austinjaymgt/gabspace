// src/components/Icon.jsx
//
// Gabspace icon wrapper component.
// Usage: <Icon name="events" size="md" />
//
// Default size: 'md' (20px)
// Default stroke: 1.75
// Default color: inherits from parent via currentColor
//
// To add a new icon:
//   1. Import it from 'lucide-react' below
//   2. Add it to ICON_MAP with a semantic Gabspace name
//   3. Document it in the brand kit if it's a new category

import {
  // Navigation & Layout
  LayoutDashboard, Search, Menu, X, ArrowLeft, Settings, Bell,
  CircleUser, PanelLeft, MoreVertical, ExternalLink,
  ChevronDown, ChevronRight, LogOut, Building2, Wrench, BookOpen, UsersRound,
  // Events
  CalendarDays, Plus, Clock, Calendar, MapPin, Users, Lightbulb,
  FileText, Sparkles, ClipboardList, CheckCircle2, Radio, Archive,
  // Clients & CRM
  UserRound, User, UserPlus, UserSearch, Mail, Phone, MessageCircle,
  LayoutPanelLeft, Tag,
  // Projects & Tasks
  FolderKanban, CheckSquare, Square, ListChecks, Flag, CalendarClock,
  AlertCircle, Star,
  // Finance
  Wallet, ReceiptText, BadgeCheck, TrendingUp, TrendingDown,
  FileSignature, ScrollText,
  // Files & Media
  Upload, Download, File, Image, Folder, Paperclip, Link,
  // Status & Feedback
  AlertTriangle, XCircle, Info, Loader2, Inbox,
  // Actions
  Pencil, Trash2, Copy, Share2, Save, SlidersHorizontal,
  ArrowUpDown, RefreshCw,
  // Community
  Hash, MessageSquareText, Heart, Trophy, Camera, Palette,
  // AI & Delight
  Wand2,
} from 'lucide-react';

// Semantic name → Lucide component
// Keep this sorted by category. Add new icons alphabetically within a category.
const ICON_MAP = {
  // Navigation & Layout
  'dashboard': LayoutDashboard,
  'search': Search,
  'menu': Menu,
  'close': X,
  'back': ArrowLeft,
  'settings': Settings,
  'notifications': Bell,
  'profile': CircleUser,
  'sidebar-toggle': PanelLeft,
  'more': MoreVertical,
  'external': ExternalLink,
  'expand': ChevronDown,
  'collapse': ChevronRight,
  'signout': LogOut,
  'operations': Wrench,
  'intranet': Building2,
  'book': BookOpen,
  'team': UsersRound,

  // Events
  'events': CalendarDays,
  'add': Plus,
  'time': Clock,
  'date': Calendar,
  'location': MapPin,
  'guests': Users,
  'idea': Lightbulb,
  'brief': FileText,
  // Event lifecycle
  'event-concept': Sparkles,
  'event-planning': ClipboardList,
  'event-confirmed': CheckCircle2,
  'event-live': Radio,
  'event-wrapped': Archive,

  // Clients & CRM
  'clients': UserRound,
  'client': User,
  'client-add': UserPlus,
  'lead': UserSearch,
  'email': Mail,
  'phone': Phone,
  'message': MessageCircle,
  'portal': LayoutPanelLeft,
  'tag': Tag,

  // Projects & Tasks
  'projects': FolderKanban,
  'task-done': CheckSquare,
  'task': Square,
  'checklist': ListChecks,
  'milestone': Flag,
  'deadline': CalendarClock,
  'priority': AlertCircle,
  'star': Star,

  // Finance
  'finance': Wallet,
  'invoice': ReceiptText,
  'paid': BadgeCheck,
  'revenue': TrendingUp,
  'expense': TrendingDown,
  'proposal': FileSignature,
  'contract': ScrollText,

  // Files & Media
  'upload': Upload,
  'download': Download,
  'file': File,
  'image': Image,
  'folder': Folder,
  'attachment': Paperclip,
  'link': Link,

  // Status & Feedback
  'success': CheckCircle2,
  'warning': AlertTriangle,
  'error': XCircle,
  'info': Info,
  'loading': Loader2,
  'empty': Inbox,

  // Actions
  'edit': Pencil,
  'delete': Trash2,
  'duplicate': Copy,
  'share': Share2,
  'save': Save,
  'filter': SlidersHorizontal,
  'sort': ArrowUpDown,
  'refresh': RefreshCw,

  // Community
  'community': Hash,
  'channel': Hash,
  'post': MessageSquareText,
  'reaction': Heart,
  'win': Trophy,
  'photography': Camera,
  'creative': Palette,

  // AI & Delight
  'ai': Sparkles,
  'magic': Wand2,
};

// Size scale — mirrors the brand kit Iconography section.
// Use named tokens by default. Raw numbers accepted as an escape hatch.
const SIZES = {
  sm: 16,  // dense UI, inline text
  md: 20,  // default — buttons, badges, most UI
  lg: 24,  // nav, sidebar
  xl: 32,  // feature surfaces, empty states
};

export function Icon({
  name,
  size = 'md',
  color,
  strokeWidth = 1.75,
  className,
  style,
  ...props
}) {
  const LucideIcon = ICON_MAP[name];

  if (!LucideIcon) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[Icon] Unknown name: "${name}". Add it to ICON_MAP in Icon.jsx`);
    }
    return null;
  }

  const pixelSize = typeof size === 'number' ? size : SIZES[size];
  const isSpinning = name === 'loading';

  return (
    <LucideIcon
      size={pixelSize}
      strokeWidth={strokeWidth}
      color={color}  // undefined → inherits currentColor from parent
      className={`${isSpinning ? 'icon-spin' : ''} ${className || ''}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

// Export the map and sizes for tooling (e.g. building a preview page,
// writing tests, generating type defs when you move to TypeScript).
