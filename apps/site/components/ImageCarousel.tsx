'use client';

import { useState } from 'react';

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export default function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  // Se só tem uma imagem, mostrar direto sem controles
  if (images.length === 1) {
    return (
      <div className="relative h-64 md:h-80 bg-gray-100">
        <img
          src={images[0]}
          alt={alt}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative h-64 md:h-80 bg-gray-100 group">
      {/* Imagem atual */}
      <img
        src={images[currentIndex]}
        alt={`${alt} - Imagem ${currentIndex + 1}`}
        className="w-full h-full object-contain transition-opacity duration-300"
      />

      {/* Botões de navegação */}
      {images.length > 1 && (
        <>
          {/* Botão anterior */}
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Imagem anterior"
          >
            ‹
          </button>

          {/* Botão próximo */}
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Próxima imagem"
          >
            ›
          </button>
        </>
      )}

      {/* Indicadores */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Ir para imagem ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Contador de imagens */}
      {images.length > 1 && (
        <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
