/**
 * ModolAI Icon System
 *
 * Phosphor Icons (@phosphor-icons/react) 기반.
 * 기존 lucide-react 이름을 그대로 export하여 기존 코드 변경 최소화.
 *
 * Weight 전략:
 *  - 기본: "light"        → 고급스러운 editorial 느낌
 *  - AI 아이콘: "duotone"  → Bot, Sparkles — 시각적 계층 강조
 *  - 상태/피드백: "regular" → 작은 크기에서도 명확하게 인지
 *  - shadcn/ui 프리미티브: "regular" → 체크박스, 셀렉트 등 정밀 렌더링
 */

import {
  Heartbeat as PhHeartbeat,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowsClockwise as PhArrowsClockwise,
  Bell as PhBell,
  Briefcase as PhBriefcase,
  Building as PhBuilding,
  Buildings as PhBuildings,
  Calendar as PhCalendar,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  ChartBar as PhChartBar,
  ChartPie as PhChartPie,
  ChatCircle as PhChatCircle,
  ChatText as PhChatText,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  Circle as PhCircle,
  CircleNotch as PhCircleNotch,
  Clock as PhClock,
  ClockCounterClockwise as PhClockCounterClockwise,
  Code as PhCode,
  Coins as PhCoins,
  Copy as PhCopy,
  Cpu as PhCpu,
  Database as PhDatabase,
  DeviceMobile as PhDeviceMobile,
  DotsSixVertical as PhDotsSixVertical,
  DownloadSimple as PhDownloadSimple,
  Envelope as PhEnvelope,
  EnvelopeOpen as PhEnvelopeOpen,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  FloppyDisk as PhFloppyDisk,
  Funnel as PhFunnel,
  Gear as PhGear,
  Globe as PhGlobe,
  GridFour as PhGridFour,
  HardDrives as PhHardDrives,
  Hash as PhHash,
  House as PhHouse,
  Image as PhImage,
  Info as PhInfo,
  Key as PhKey,
  Lightning as PhLightning,
  Lightbulb as PhLightbulb,
  List as PhList,
  ListBullets as PhListBullets,
  Lock as PhLock,
  MagnifyingGlass as PhMagnifyingGlass,
  Monitor as PhMonitor,
  Moon as PhMoon,
  PaperPlaneTilt as PhPaperPlaneTilt,
  Pause as PhPause,
  Pencil as PhPencil,
  PencilLine as PhPencilLine,
  PencilSimple as PhPencilSimple,
  Phone as PhPhone,
  Play as PhPlay,
  Plus as PhPlus,
  Power as PhPower,
  Presentation as PhPresentation,
  Prohibit as PhProhibit,
  Question as PhQuestion,
  Robot as PhRobot,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  ShieldSlash as PhShieldSlash,
  ShieldWarning as PhShieldWarning,
  SignIn as PhSignIn,
  SignOut as PhSignOut,
  Sparkle as PhSparkle,
  SquaresFour as PhSquaresFour,
  Sun as PhSun,
  Table as PhTable,
  Terminal as PhTerminal,
  ThumbsDown as PhThumbsDown,
  ThumbsUp as PhThumbsUp,
  Trash as PhTrash,
  TrendUp as PhTrendUp,
  UploadSimple as PhUploadSimple,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserMinus as PhUserMinus,
  UserPlus as PhUserPlus,
  Users as PhUsers,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  X as PhX,
  XCircle as PhXCircle,
} from '@phosphor-icons/react/dist/ssr';

/**
 * 기본 weight를 주입하는 래퍼 팩토리.
 * 호출 시 weight prop을 전달하면 오버라이드 가능.
 */
function w(Icon, defaultWeight = 'light') {
  function IconWrapper({ weight, ...props }) {
    return <Icon weight={weight ?? defaultWeight} {...props} />;
  }
  IconWrapper.displayName = Icon.displayName ?? Icon.name;
  return IconWrapper;
}

// ─── Navigation ────────────────────────────────────────────────────────────
export const ArrowLeft       = w(PhArrowLeft);
export const Bell            = w(PhBell);
export const ChevronDown     = w(PhCaretDown);
export const ChevronLeft     = w(PhCaretLeft);
export const ChevronRight    = w(PhCaretRight);
export const ChevronUp       = w(PhCaretUp);
export const ExternalLink    = w(PhArrowSquareOut);
export const Home            = w(PhHouse);
export const LayoutDashboard = w(PhSquaresFour);
export const LogOut          = w(PhSignOut);
export const Menu            = w(PhList);
export const MessageSquare   = w(PhChatText);
export const Settings        = w(PhGear);
export const User            = w(PhUser);

// ─── Actions ───────────────────────────────────────────────────────────────
export const Copy      = w(PhCopy);
export const Download  = w(PhDownloadSimple);
export const Edit      = w(PhPencilSimple);
export const Edit2     = w(PhPencil);
export const Edit3     = w(PhPencilLine);
export const Eye       = w(PhEye);
export const EyeOff    = w(PhEyeSlash);
export const Filter    = w(PhFunnel);
export const GripVertical = w(PhDotsSixVertical);
export const Lock      = w(PhLock);
export const LogIn     = w(PhSignIn);
export const Mail      = w(PhEnvelope);
export const Pause     = w(PhPause);
export const Pencil    = w(PhPencil);
export const Play      = w(PhPlay);
export const Plus      = w(PhPlus);
export const Power     = w(PhPower);
export const PowerOff  = w(PhProhibit);
export const RefreshCw = w(PhArrowsClockwise);
export const RotateCcw = w(PhArrowCounterClockwise);
export const Save      = w(PhFloppyDisk);
export const Search    = w(PhMagnifyingGlass);
export const Trash2    = w(PhTrash);
export const Upload    = w(PhUploadSimple);
export const UserPlus  = w(PhUserPlus);
export const X         = w(PhX, 'regular');

// ─── Status / Feedback ─────────────────────────────────────────────────────
// "regular" weight: 소형 아이콘에서도 명확히 인지되도록
export const AlertCircle  = w(PhWarningCircle, 'regular');
export const AlertTriangle = w(PhWarning, 'regular');
export const Check        = w(PhCheck, 'regular');
export const CheckCircle  = w(PhCheckCircle, 'regular');
export const CheckCircle2 = w(PhCheckCircle, 'fill');   // filled variant
export const CircleHelp   = w(PhQuestion);
export const HelpCircle   = w(PhQuestion);
export const Info         = w(PhInfo, 'regular');
export const Loader2      = w(PhCircleNotch, 'regular'); // animate-spin과 함께 사용
export const ShieldAlert  = w(PhShieldWarning, 'regular');
export const ShieldCheck  = w(PhShieldCheck, 'regular');
export const ShieldX      = w(PhShieldSlash, 'regular');
export const TriangleAlert = w(PhWarning, 'regular');
export const XCircle      = w(PhXCircle, 'regular');

// ─── Chat / Message ─────────────────────────────────────────────────────────
export const Bot          = w(PhRobot, 'duotone');  // AI 아이콘 — duotone으로 강조
export const History      = w(PhClockCounterClockwise);
export const LucideImage  = w(PhImage);              // Next.js Image 충돌 방지 alias
export const MailOpen     = w(PhEnvelopeOpen);
export const MessageCircle = w(PhChatCircle);
export const Presentation = w(PhPresentation);
export const Send         = w(PhPaperPlaneTilt);
export const Sparkles     = w(PhSparkle, 'duotone'); // AI 생성 — duotone으로 강조
export const ThumbsDown   = w(PhThumbsDown);
export const ThumbsUp     = w(PhThumbsUp);

// ─── Admin / Settings ───────────────────────────────────────────────────────
export const Activity        = w(PhHeartbeat);
export const BarChart3       = w(PhChartBar);
export const Building        = w(PhBuildings);  // 조직/회사 = Buildings (복수)
export const Building2       = w(PhBuilding);   // 단일 건물
export const Calendar        = w(PhCalendar);
export const Clock           = w(PhClock);
export const Code            = w(PhCode);
export const Coins           = w(PhCoins);
export const Cpu             = w(PhCpu);
export const Database        = w(PhDatabase);
export const Key             = w(PhKey);
export const LayoutGrid      = w(PhGridFour);
export const Lightbulb       = w(PhLightbulb);
export const List            = w(PhListBullets); // bulleted list (Menu와 구분)
export const Monitor         = w(PhMonitor);
export const Server          = w(PhHardDrives);
export const Shield          = w(PhShield);
export const Smartphone      = w(PhDeviceMobile);
export const Table           = w(PhTable);
export const Terminal        = w(PhTerminal);
export const TrendingUp      = w(PhTrendUp);
export const UserCheck       = w(PhUserCheck);
export const UserX           = w(PhUserMinus);
export const Users           = w(PhUsers);

// ─── Misc ────────────────────────────────────────────────────────────────────
export const Briefcase = w(PhBriefcase);
export const Globe     = w(PhGlobe);
export const Hash      = w(PhHash);
export const Moon      = w(PhMoon);
export const Phone     = w(PhPhone);
export const Sun       = w(PhSun);
export const Zap       = w(PhLightning);

// ─── shadcn/ui 프리미티브 전용 ────────────────────────────────────────────────
// checkbox, select, dropdown, radio-group, sheet, dialog, sonner 내부에서 사용
// "regular" weight: 작은 크기(14–16px)에서 선명한 렌더링
export const CheckIcon         = w(PhCheck, 'regular');
export const ChevronDownIcon   = w(PhCaretDown, 'regular');
export const ChevronRightIcon  = w(PhCaretRight, 'regular');
export const ChevronUpIcon     = w(PhCaretUp, 'regular');
export const CircleIcon        = w(PhCircle, 'regular');
export const CircleCheckIcon   = w(PhCheckCircle, 'regular');
export const InfoIcon          = w(PhInfo, 'regular');
export const Loader2Icon       = w(PhCircleNotch, 'regular');
export const OctagonXIcon      = w(PhXCircle, 'regular');
export const TriangleAlertIcon = w(PhWarning, 'regular');
export const XIcon             = w(PhX, 'regular');

// ─── 추가 alias (일부 파일에서 Icon suffix로 import) ─────────────────────────
export const ImageIcon    = w(PhImage);
export const PieChartIcon = w(PhChartPie);
