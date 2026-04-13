import React from 'react';
import { motion } from 'motion/react';

export default function DreamwaveOcean() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Top Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-dream-blue/20 via-dream-purple/10 to-transparent blur-[100px]" />
      
      {/* Animated Wave Layers */}
      <div className="absolute bottom-0 w-full h-2/3">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-[300%] h-full bg-gradient-to-t from-dream-cyan/10 to-transparent backdrop-blur-[2px]"
            style={{
              bottom: `${-20 + i * 10}%`,
              left: '-100%',
              opacity: 0.3 - i * 0.05,
              zIndex: 10 - i
            }}
            animate={{
              x: i % 2 === 0 ? ['-10%', '10%', '-10%'] : ['10%', '-10%', '10%'],
              y: [0, 20, 0],
              scaleY: [1, 1.1, 1]
            }}
            transition={{ duration: 10 + i * 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Floating Sparkles */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, opacity: Math.random() * 0.3 }}
          animate={{ y: [0, -100, 0], opacity: [0, 0.4, 0] }}
          transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5 }}
        />
      ))}
    </div>
  );
}
