# Что? Где? Step3D!

Минималистичный статический сайт для синхронной игры в формате «Что? Где? Когда?» с двумя режимами:

- **ONLINE (Firebase)** — realtime через Firebase Realtime Database.
- **DEMO (Offline)** — локальный режим на одном устройстве через `localStorage`.

## Структура проекта

```
/
  index.html
  join.html
  host.html
  captain.html
  player.html
  game.html
  css/style.css
  js/app.js
  js/store.js
  js/firebase-config.js
  js/firebase-store.js
  js/offline-store.js
  js/ui.js
  js/wheel.js
  js/sound.js
  js/qr.js
  assets/sounds/*.mp3
  assets/icons/step3d-mark.svg
  vendor/qrcode.min.js
```

## Offline demo (по умолчанию)

1. Откройте `index.html` через Live Server (VS Code) или любой локальный сервер.
2. Создайте игру на стартовой странице.
3. Подключайтесь с нескольких вкладок/устройств, используя QR или ссылку.

**Важно:** в DEMO режиме синхронизация работает через `localStorage`, поэтому подходит для демонстраций.

## Подключение Firebase

1. В файле `js/firebase-config.js` вставьте данные проекта Firebase и установите `firebaseEnabled = true`.
2. Подключение использует Firebase Realtime Database.

Пример конфигурации:

```js
export const firebaseEnabled = true;
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
};
```

### Минимальные правила безопасности (Realtime Database)

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> Для продакшена обязательно ограничьте права на запись.

## GitHub Pages

1. Загрузите репозиторий в GitHub.
2. В настройках GitHub Pages выберите ветку `main` и корневую папку `/`.
3. Сайт будет доступен по адресу:
   `https://<username>.github.io/ChGK/`

## Как играть

1. **Ведущий** открывает `index.html` или сразу `host.html`, создаёт игру и управляет командами и раундами в одном экране.
2. **Капитаны** подключаются через `join.html`, вводят код капитана, добавляют вопросы.
3. **Ведущий** запускает волчок и раунды прямо в `host.html`. При необходимости можно открыть `game.html` как второй экран.
4. **Участники** наблюдают игру на `player.html`.

---

Запуск локально:

```bash
# Любой локальный сервер, например:
python -m http.server 8000
```

Откройте `http://localhost:8000/`.
