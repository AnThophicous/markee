import { Image, Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useViewerStore } from '@/features/navigation/store/useUiStore';

type PostImageGridProps = {
  images: string[];
  /** Na tela de detalhe cabe mais foto do que no cartão do feed. */
  variant?: 'card' | 'detail';
};

/** Mosaico de fotos do post. Tocar abre o visualizador em tela cheia com zoom. */
export function PostImageGrid({ images, variant = 'card' }: PostImageGridProps) {
  const openViewer = useViewerStore((state) => state.open);

  if (images.length === 0) return null;

  const visible = variant === 'card' ? images.slice(0, 4) : images;
  const hidden = images.length - visible.length;
  const single = visible.length === 1;
  const height = single ? (variant === 'detail' ? 320 : 224) : variant === 'detail' ? 180 : 128;

  return (
    <View className="mt-2.5 flex-row flex-wrap gap-1.5">
      {visible.map((url, index) => (
        <Pressable
          key={url}
          onPress={() => openViewer(images, index)}
          className="overflow-hidden rounded-xl active:opacity-85"
          style={single ? { width: '100%' } : { flexGrow: 1, flexBasis: '48%' }}
        >
          <Image source={{ uri: url }} style={{ width: '100%', height }} resizeMode="cover" />

          {hidden > 0 && index === visible.length - 1 ? (
            <View className="absolute inset-0 items-center justify-center bg-black/45">
              <AppText style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>+{hidden}</AppText>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
