import {
  Activity,
  ArrowLeft,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Camera,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Clock3,
  Compass,
  ContactRound,
  Eye,
  Film,
  Gamepad2,
  Globe2,
  Grid2X2,
  Heart,
  House,
  Info,
  Link2,
  LogOut,
  Menu,
  MessageCircle,
  MessageCircleMore,
  MessageSquare,
  MessagesSquare,
  Mic,
  Moon,
  MoreHorizontal,
  Palette,
  Paperclip,
  Pause,
  Pencil,
  Phone,
  Pin,
  Play,
  Plus,
  Repeat2,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sun,
  Tag,
  UserRound,
  UserRoundPlus,
  Video,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "home" | "explore" | "messages" | "activity" | "saved" | "profile" | "settings"
  | "plus" | "logout" | "search" | "heart" | "comment" | "bookmark" | "send" | "close"
  | "camera" | "back" | "paperclip" | "smile" | "more" | "reels" | "eye" | "phone"
  | "mic" | "repost" | "clock" | "grid" | "tag" | "menu" | "chevronDown" | "play"
  | "pause" | "volume" | "mute" | "link" | "userPlus" | "tagged" | "chatRound"
  | "bellModern" | "heartModern" | "commentModern" | "shareModern" | "repostModern"
  | "bookmarkModern" | "pin" | "edit" | "video" | "palette" | "plane" | "gamepad"
  | "shield" | "globe" | "sliders" | "info" | "sun" | "moon" | "scan" | "refresh"
  | "homeModern" | "compassModern" | "messagesModern" | "settingsModern" | "userModern"
  | "gridModern" | "filmModern" | "cameraModern";

const ICONS: Record<IconName, LucideIcon> = {
  home: House,
  homeModern: House,
  explore: Compass,
  compassModern: Compass,
  messages: MessageSquare,
  messagesModern: MessagesSquare,
  activity: Activity,
  bellModern: BellRing,
  saved: Bookmark,
  bookmark: Bookmark,
  bookmarkModern: BookmarkCheck,
  profile: UserRound,
  userModern: UserRound,
  settings: Settings2,
  settingsModern: Settings2,
  plus: Plus,
  logout: LogOut,
  search: Search,
  heart: Heart,
  heartModern: Heart,
  comment: MessageCircle,
  commentModern: MessagesSquare,
  send: Send,
  plane: Send,
  shareModern: Share2,
  close: X,
  camera: Camera,
  cameraModern: Camera,
  back: ArrowLeft,
  paperclip: Paperclip,
  smile: Smile,
  more: MoreHorizontal,
  reels: Clapperboard,
  filmModern: Film,
  eye: Eye,
  phone: Phone,
  mic: Mic,
  repost: Repeat2,
  repostModern: Repeat2,
  clock: Clock3,
  grid: Grid2X2,
  gridModern: Grid2X2,
  tag: Tag,
  menu: Menu,
  chevronDown: ChevronDown,
  play: Play,
  pause: Pause,
  volume: Volume2,
  mute: VolumeX,
  link: Link2,
  userPlus: UserRoundPlus,
  tagged: ContactRound,
  chatRound: MessageCircleMore,
  pin: Pin,
  edit: Pencil,
  video: Video,
  palette: Palette,
  gamepad: Gamepad2,
  shield: ShieldCheck,
  globe: Globe2,
  sliders: SlidersHorizontal,
  info: Info,
  sun: Sun,
  moon: Moon,
  scan: ScanLine,
  refresh: RefreshCw,
};

export default function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const Glyph = ICONS[name] ?? CircleHelp;

  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="avenzo-icon"
    />
  );
}
