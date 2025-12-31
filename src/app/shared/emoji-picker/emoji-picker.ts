import { Component, signal, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emoji-picker',
  imports: [CommonModule],
  templateUrl: './emoji-picker.html',
  styleUrl: './emoji-picker.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EmojiPicker {
  showPicker = signal(false);
  selectedEmoji = signal('😊');
  emojiSelected = output<string>();

  emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
    '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🥚', '🍳',
    '🧈', '🥞', '🥐', '🍞', '🥖', '🥨', '🥯', '🧀',
    '🎂', '🍰', '🎉', '🎊', '🎈', '🎁', '🎀', '🎆',
    '✈️', '🚀', '🚗', '🚙', '🚕', '🚌', '🚎', '🏎️',
    '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '⛵', '🚤',
    '💼', '👔', '👗', '👠', '👡', '👢', '👞', '👟',
    '🧥', '🧤', '🧣', '👓', '💎', '⌚', '💍', '🎒',
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
    '🥏', '🎳', '🎣', '🎽', '🎿', '⛷️', '🛂', '🎯',
  ];

  togglePicker() {
    this.showPicker.set(!this.showPicker());
  }

  selectEmoji(emoji: string) {
    console.log('selectEmoji called with:', emoji);
    this.selectedEmoji.set(emoji);
    console.log('Emitting emoji:', emoji);
    this.emojiSelected.emit(emoji);
    console.log('Emoji emitted');
    this.showPicker.set(false);
  }

  closePicker() {
    this.showPicker.set(false);
  }
}
