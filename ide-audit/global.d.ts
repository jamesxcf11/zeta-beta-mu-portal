// Type declarations for ZBM portal globals injected by the app's JS modules

interface Window {
  ThemeManager?: {
    setTheme(theme: string): void;
    toggle(): void;
    init(): void;
  };
  LandingModule?: {
    albums: Array<{ title: string; photos: string[]; category: string; year: string; location: string }>;
    openAlbum(index: number): void;
    closeLightbox(): void;
    navigateLightbox(direction: number): void;
  };
  VaultModule?: {
    openUploadModal(): void;
    closeUploadModal(): void;
    toggleYearDropdown(event: Event): void;
    toggleOfficerView(): void;
  };
  FeedModule?: {
    toggleNotificationDropdown(): void;
    markAllNotificationsRead(): void;
    showToast(message: string): void;
    loadMore(): void;
  };
  AdminModule?: {
    openAddMemberModal(): void;
    openEditMemberModal(member: unknown): void;
    buildModal(title: string, bodyHtml: string, submitLabel: string, onSubmit: (form: HTMLElement) => void): void;
    closeModal(): void;
  };
  AuthHelper?: {
    logout(): void;
    updateUI(): void;
  };
}
