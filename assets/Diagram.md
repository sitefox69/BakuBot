Schemat działania

                         ┌─────────────────────┐
                         │       DISCORD       │
                         │                     │
                         │ /plan               │
                         │ /gra                │
                         │ /log                │
                         │ /xayoo              │
                         └──────────┬──────────┘
                                    │
                                    │ POST /discord
                                    ▼
                         ┌─────────────────────┐
                         │  CLOUDFLARE WORKER  │
                         │                     │
                         │      worker.js      │
                         └──────────┬──────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
                ▼                   ▼                   ▼
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │   plan.js    │    │  steam.js    │    │   ttv.js     │
        │              │    │              │    │              │
        │ /plan        │    │ /steam       │    │ /log         │
        │ /zmiana      │    │ /gra         │    │ Twitch       │
        └──────┬───────┘    └──────────────┘    └──────────────┘
               │
               │
               ▼
        ┌──────────────┐
        │   KV PARIS   │
        │              │
        │     plan     │
        │              │
        │ przechowuje  │
        │ aktualny     │
        │ plan         │
        └──────┬───────┘
               │
               │
               ▼
        ┌─────────────────────┐
        │ Discord – Plan      │
        │                     │
        │ PLAN_CHANNEL_ID_1   │
        │ PLAN_CHANNEL_ID_2   │
        └─────────────────────┘
┌─────────────────────┐
│   STREAM ELEMENTS   │
│                     │
│ !zmiana tekst       │
│ !gra nazwa gry      │
│ !log streamer user  │
│ !xayoo streamer     │
└──────────┬──────────┘
           │
           │ HTTPS GET
           ▼
┌─────────────────────────────┐
│      CLOUDFLARE WORKER      │
│                             │
│ /zmiana                     │
│ /steam                      │
│ /log                        │
│ /xayoo                      │
└─────────────┬───────────────┘
              │
              │
              ▼
       ┌──────────────┐
       │   KV PARIS   │
       │              │
       │ aktualny plan│
       └──────┬───────┘
              │
              │ !zmiana
              ▼
       ┌─────────────────────────┐
       │         DISCORD         │
       │                         │
       │ @everyone               │
       │ Plan został zmieniony   │
       │ przez: *nick*           │
       │ **tekst**                │
       │                         │
       │ ┌─────────────────────┐ │
       │ │ PLAN_CHANNEL_ID_1   │ │
       │ └─────────────────────┘ │
       │ ┌─────────────────────┐ │
       │ │ PLAN_CHANNEL_ID_2   │ │
       │ └─────────────────────┘ │
       └─────────────────────────┘

Przepływ zmiany planu

Discord:

/plan tekst
      │
      ▼
Cloudflare Worker
      │
      ├──► KV PARIS → zapis planu
      │
      └──► Discord
             │
             ├──► PLAN_CHANNEL_ID_1
             └──► PLAN_CHANNEL_ID_2

Wiadomość:

@everyone
**tekst**

StreamElements:

!zmiana tekst
      │
      ▼
/zmiana?secret=MODERATOR_SECRET
      │
      ▼
Cloudflare Worker
      │
      ├──► sprawdzenie MODERATOR_SECRET
      │
      ├──► KV PARIS → zapis planu
      │
      └──► Discord
             │
             ├──► PLAN_CHANNEL_ID_1
             └──► PLAN_CHANNEL_ID_2

Wiadomość:

@everyone
Plan został zmieniony przez: *nick*
**tekst**

Przepływ komendy Steam

Discord /gra
      │
      ▼
Cloudflare Worker
      │
      ▼
steam.js
      │
      ▼
Steam
      │
      ▼
informacje o grze
      │
      ▼
Discord

StreamElements działa analogicznie:

!gra nazwa gry
      │
      ▼
/steam?game=nazwa%20gry
      │
      ▼
steam.js
      │
      ▼
Steam
      │
      ▼
StreamElements

Główne elementy systemu

┌─────────────────────────────────────────────┐
│                 BakuBot                     │
├─────────────────────────────────────────────┤
│                                             │
│ Discord                                     │
│   ├── /plan                                 │
│   ├── /gra                                  │
│   ├── /log                                  │
│   └── /xayoo                                │
│                                             │
│ StreamElements                              │
│   ├── !zmiana                               │
│   ├── !gra                                  │
│   ├── !log                                  │
│   └── !xayoo                                │
│                                             │
│ Cloudflare Worker                           │
│   ├── worker.js                             │
│   └── modules/                              │
│       ├── index.js                          │
│       ├── plan.js                           │
│       ├── steam.js                          │
│       ├── ttv.js                            │
│       └── xayo.js                           │
│                                             │
│ Cloudflare KV                               │
│   └── PARIS → aktualny plan                 │
│                                             │
│ Discord                                     │
│   ├── PLAN_CHANNEL_ID_1                     │
│   └── PLAN_CHANNEL_ID_2                     │
│                                             │
└─────────────────────────────────────────────┘