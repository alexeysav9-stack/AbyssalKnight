# Abyssal Knight

2D Action-Platformer (Soulslike / Metroidvania) на чистом JavaScript и HTML5 Canvas.

## Запуск игры

Для того чтобы браузер мог загружать аудиофайлы (`.wav`) без ограничений CORS локальной файловой системы (`file://`), запускайте игру через локальный сервер:

```bash
# Через npm / npx
npm start
# или
npx serve -l 3000 .

# Либо через встроенный Python
python3 -m http.server 3000
```

После этого откройте в браузере: `http://localhost:3000`

---

## Аудиосистема и звуковые эффекты

Звуковые файлы расположены в папке `assets/sounds/`:
- `swing.wav`, `heavy_swing.wav`, `quick_swing.wav` — взмахи оружия
- `hit.wav`, `nail_hit.wav`, `nail_slash.wav` — удары и лязг клинков
- `dash.wav`, `dodge_roll.wav`, `dodge_success.wav` — кувырки и дэши
- `pogo.wav` — отскок от врагов/шипов (nail pogo)
- `jump.wav`, `double_jump.wav` — прыжки и крылья монарха
- `player_hurt.wav`, `enemy_death.wav` — урон и гибель врагов
- `heal.wav` — лечение за души (Soul)
- `fireball.wav`, `ice_nova.wav`, `shadow_bolt.wav` — заклинания
- `bonfire.wav` — отдых у костра
- `weapon_switch.wav` — сброс / смена оружия
- `boss_roar.wav`, `boss_telegraph.wav`, `boss_thrust_glint.wav`, `boss_void_charge.wav` — звуки босса Abyssal Warden

### Особенности звукового движка:
1. **Предзагрузка и кэширование:** аудио декодируется в память через `AudioContext.decodeAudioData`, обеспечивая мгновенный отклик без задержек.
2. **Органический питч-шифт (живой звук):** при каждом ударе или взмахе движок слегка варьирует высоту тона (pitch variation ±5–8%), благодаря чему звуки не звучат монотонно.
3. **Бесшовный фолбэк:** если игра запущена напрямую через `file://`, игра автоматически использует встроенный синтез без ошибок.
4. **Легкая замена:** вы можете заменить любой `.wav` файл в папке `assets/sounds/` на свой собственный.
5. **Генератор:** скрипт `scripts/generate_sounds.py` позволяет при необходимости заново пересоздать звуки.

