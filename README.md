# BakuBot Open Source

![Zdjęcie](IMG_7160.PNG)

## Oficjalna strona [Bota](https://sitefox.gitbook.io/bakubot-1)

# Najważniejsze funkcje

* Zmiana planu z poziomu Discorda
* Zmiana planu przez StreamElements
* Odczyt aktualnego planu na Twitchu
* Automatyczne powiadomienia na Discordzie
* Powiadomienie `@everyone`
* Informacja o osobie, która zmieniła plan
* Obsługa wielu serwerów Discord
* Obsługa wielu kanałów powiadomień Discord
* Obsługa informacji o grach ze Steam
* Wyszukiwanie logów wiadomości użytkowników Twitcha

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


# [Instalacja i konfiguracja](assets/Install.md)

