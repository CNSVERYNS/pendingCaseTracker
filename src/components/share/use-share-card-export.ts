import * as Sharing from 'expo-sharing';
import { useEffect, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { track } from '@/lib/analytics';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '@/components/share/share-card';

/**
 * Renders the share card off-screen, captures it as a PNG at the exact
 * export size regardless of device pixel ratio, and hands it to the native
 * share sheet (build brief §10). `rendering` gates mounting the hidden
 * <ShareCard> — it only exists in the tree for the moment it takes to
 * capture, since it's a fixed 1080x1350 canvas that would otherwise sit in
 * memory for the whole time Home is open.
 *
 * Takes the view ref as a parameter rather than creating and returning one
 * itself — a hook returning an object that bundles a ref alongside plain
 * state makes every property access on that object look ref-like to the
 * React Compiler's purity checks. The caller owns the ref and passes it in.
 */
export function useShareCardExport(viewRef: RefObject<View | null>) {
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);

  function trigger() {
    setRendering(true);
  }

  useEffect(() => {
    if (!rendering) return;
    let cancelled = false;

    (async () => {
      // Give the off-screen view one frame to actually lay out and paint
      // before we try to capture it.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (cancelled || !viewRef.current) {
        setRendering(false);
        return;
      }

      setExporting(true);
      try {
        const uri = await captureRef(viewRef, {
          format: 'png',
          quality: 1,
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share timeline' });
        }
        void track('share_card_exported');
      } finally {
        if (!cancelled) {
          setExporting(false);
          setRendering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rendering, viewRef]);

  return { rendering, exporting, trigger };
}
