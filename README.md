# BakuBot Open Source

![Zdjęcie](assets/IMG_7190.png)

## Oficjalna strona [Bota](https://sitefox.gitbook.io/bakubot-1)

# Najważniejsze funkcje

- Zmiana planu z poziomu Discorda
- Zmiana planu przez StreamElements
- Automatyczne zapisywanie i synchronizacja planu
- Automatyczne powiadomienia na Discordzie
- Automatyczne powiadomienie `@everyone`
- Informacja o osobie, która zmieniła plan
- Obsługa wielu serwerów Discord
- Obsługa wielu kanałów powiadomień Discord
- Informacje o grach ze Steam
- Wyszukiwanie logów wiadomości użytkowników Twitcha
- Sprawdzanie czasu oglądania streamera
- Integracja z Discordem, StreamElements i Twitch

## Schemat działania
```text
                         ┌──────────────┐
                         │   DISCORD    │
                         └──────┬───────┘
                                │
                                │ żądania/interakcje
                                ▼
                    ┌──────────────────────┐
                    │        WORKER        │
                    │      Cloudflare      │
                    └───────┬───────┬──────┘
                            │       │
              ┌─────────────┘       └─────────────┐
              │                                   │
              ▼                                   ▼
     ┌─────────────────┐                 ┌─────────────────┐
     │   DANE/LOGIKA   │                 │ STREAMELEMENTS  │
     │      BOTA       │                 │     /TWITCH     │
     └─────────────────┘                 └─────────────────┘
              ▲                                   │
              │                                   │
              └──────────── odpowiedź ────────────┘
```
## Powiadomienia
W określonych sytuacjach Worker może również wysłać wiadomość na Discorda: 
```text
StreamElements
       │
       ▼
    Worker
       │
       ├──────► zapis / przetworzenie danych
       │
       └──────► powiadomienie Discord
```

Dzięki temu Worker stanowi wspólny punkt dla Discorda i StreamElements, ale oba systemy komunikują się z Workerem niezależnie.


# [Instalacja i konfiguracja](assets/Guide.md)

![Zdjęcie](assets/IMG_7186.png)
