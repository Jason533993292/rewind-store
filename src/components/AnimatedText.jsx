import { useState, useEffect } from 'react';

export default function AnimatedText({ texts = [], typingSpeed = 75, pauseDuration = 2000 }) {
  const [displayed, setDisplayed] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!texts.length) return;
    const current = texts[textIndex];
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charIndex < current.length) {
          setDisplayed(current.slice(0, charIndex + 1));
          setCharIndex(c => c + 1);
        } else {
          setTimeout(() => setDeleting(true), pauseDuration);
        }
      } else {
        if (charIndex > 0) {
          setDisplayed(current.slice(0, charIndex - 1));
          setCharIndex(c => c - 1);
        } else {
          setDeleting(false);
          setTextIndex((textIndex + 1) % texts.length);
        }
      }
    }, deleting ? typingSpeed / 2 : typingSpeed);
    return () => clearTimeout(timeout);
  }, [charIndex, deleting, textIndex, texts, typingSpeed, pauseDuration]);

  return <span>{displayed}<span className="type-cursor">|</span></span>;
}
