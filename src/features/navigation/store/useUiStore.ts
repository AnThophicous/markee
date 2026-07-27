import { create } from 'zustand';

type UiState = {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
}));

type ViewerState = {
  images: string[];
  index: number;
  open: (images: string[], index?: number) => void;
  close: () => void;
};

/**
 * O visualizador de fotos vive num store, não numa rota: as URLs do storage
 * são longas e passar meia dúzia delas como parâmetro de navegação é frágil.
 */
export const useViewerStore = create<ViewerState>((set) => ({
  images: [],
  index: 0,
  open: (images, index = 0) => set({ images, index }),
  close: () => set({ images: [], index: 0 }),
}));
