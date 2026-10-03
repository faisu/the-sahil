'use client';
import { useEffect } from 'react';
import { preload } from 'react-dom';
import { initTour } from '@/lib/tour';
import { MODELS } from '@/lib/scene';
import 'maplibre-gl/dist/maplibre-gl.css';

// Mounts the scroll-driven 3D tour over the static markup rendered by the server.
export default function Tour({ children }) {
  preload(MODELS.core, { as: 'fetch', crossOrigin: 'anonymous' });
  useEffect(() => initTour(), []);
  return children;
}
