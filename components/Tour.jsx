'use client';
import { useEffect } from 'react';
import { initTour } from '@/lib/tour';
import 'maplibre-gl/dist/maplibre-gl.css';

// Mounts the scroll-driven 3D tour over the static markup rendered by the server.
export default function Tour({ children }) {
  useEffect(() => initTour(), []);
  return children;
}
