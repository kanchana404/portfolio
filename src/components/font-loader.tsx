'use client';

import { useEffect } from 'react';

export default function FontLoader() {
  useEffect(() => {
    // Ensure Inter font is loaded
    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  return null;
}
