"use client";

import { useEffect, useRef, useState } from "react";
import { useRuntimePreferences } from "../../settings/lib/runtime-preferences";
import Icon from "./icon";

export default function ExploreVideoPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const preferences = useRuntimePreferences();
  const saveData = preferences.data_saving_mode || preferences.use_less_mobile_data;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  if (failed || saveData) return <span className="explore-text-tile"><Icon name="play" size={28} />Open video</span>;

  return <video ref={ref} src={visible && !saveData ? src : undefined}
    muted playsInline preload={visible && !saveData ? "metadata" : "none"}
    onError={() => setFailed(true)} aria-label="Video preview" />;
}
