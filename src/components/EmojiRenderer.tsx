import React from 'react';
import { Emoji, EmojiStyle } from 'emoji-picker-react';

const charToUnified = (char: string) =>
  Array.from(char)
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(hex => hex !== 'fe0f')
    .join('-');

export const EmojiRenderer = ({ text }: { text: string }) => {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return <>{text}</>;
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(text));
    return (
      <>
        {segments.map((s, i) => {
          const char = s.segment;
          const isEmoji =
            /\p{Emoji_Presentation}/u.test(char) ||
            /\p{Emoji}\uFE0F/u.test(char) ||
            /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(char);
          if (isEmoji) {
            return (
              <span key={i} className="inline-block align-middle mx-0.5 leading-none">
                <Emoji unified={charToUnified(char)} size={16} emojiStyle={EmojiStyle.APPLE} />
              </span>
            );
          }
          return char;
        })}
      </>
    );
  } catch {
    return <>{text}</>;
  }
};
