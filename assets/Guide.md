![Zdjęcie](IMG_7189.png)

# Wymagania

Przed rozpoczęciem przygotuj:

- Konto GitHub
- Konto Cloudflare
- Aplikację Discord stworzoną w Discord Developer Portal
- Konto StreamElements
- Opcjonalnie, jeśli chcesz korzystać z integracji z Twitch
- Repozytorium tego projektu

## 1. Pobranie projektu

Sklonuj repozytorium:

```bash
git clone https://github.com/sitefox69/BakuBot.git
cd BakuBot
```

Możesz również pobrać repozytorium jako ZIP z GitHuba.

## 2. Utworzenie aplikacji Discord

Wejdź do Discord Developer Portal i utwórz nową aplikację.

Następnie:

1. Wejdź w **Bot**.
2. Utwórz bota.
3. Skopiuj **Bot Token**.
4. Wejdź w **General Information**.
5. Skopiuj:
   - **Application ID**
   - **Public Key**

> **Uwaga:** Nigdy nie udostępniaj Bot Tokena. Jest to poufny klucz dostępu do Twojego bota.

## 3. Utworzenie Workera

Zaloguj się do Cloudflare i przejdź do **Workers & Pages**.

Utwórz nowego Workera, a następnie wgraj pliki projektu:

```text
worker.js

modules/
├── index.js
├── plan.js
├── steam.js
├── ttv.js
└── xayo.js
```

Worker musi być dostępny pod publicznym adresem HTTPS.

Przykład:

```text
https://twoj-worker.workers.dev
```

## 4. Utworzenie KV

Worker korzysta z Cloudflare KV do przechowywania aktualnego tekstu.

W Cloudflare:

**Storage & databases → Workers KV → Create Instance**

Ustaw:

```text
Instance name: PARIS
```

Po dodaniu przejdź do:

**Compute → Workers & Pages → Twój_Worker → Bindings → Add binding**

Następnie dodaj KV namespace do Workera.

Nazwa **Variable Name** musi być dokładnie:

```text
PARIS
```

KV `PARIS` jest wykorzystywane przez moduł planu do przechowywania aktualnego tekstu planu.

Dzięki temu plan ustawiony z Discorda lub StreamElements jest zapisywany i może być później odczytany przez Workera.

## 5. Konfiguracja zmiennych

W ustawieniach Workera przejdź do:

**Settings → Variables and Secrets**

Dodaj:

| Nazwa | Wartość |
|---|---|
| `DISCORD_TOKEN` | Token bota Discord |
| `DISCORD_PUBLIC_KEY` | Public Key aplikacji Discord |
| `APPLICATION_ID` | Application ID aplikacji Discord |
| `GUILD_IDS` | ID serwerów Discord, oddzielone przecinkami |
| `PLAN_CHANNEL_ID_1` | ID pierwszego kanału planu |
| `PLAN_CHANNEL_ID_2` | ID drugiego kanału planu |
| `MODERATOR_SECRET` | Własny sekret do zmiany planu |
| `SETUP_SECRET` | Własny sekret do rejestracji komend |

Przykład:

```env
GUILD_IDS=123456789012345678,987654321098765432
PLAN_CHANNEL_ID_1=123456789012345678
PLAN_CHANNEL_ID_2=987654321098765432
```

`GUILD_IDS` może zawierać kilka serwerów Discord.

Kanały planu są ustawiane osobno przez `PLAN_CHANNEL_ID_1` i `PLAN_CHANNEL_ID_2`.

> `CHANNEL_IDS` z poprzedniej wersji nie jest już używane.

### Sekrety

Następujące wartości powinny być ustawione jako **Secrets**:

- `DISCORD_TOKEN`
- `MODERATOR_SECRET`
- `SETUP_SECRET`

> Nie umieszczaj ich bezpośrednio w kodzie ani w publicznym repozytorium.

## 6. Ustawienie Discord Interactions

W Discord Developer Portal otwórz swoją aplikację.

Przejdź do:

**General Information → Interactions Endpoint URL**

Wpisz:

```text
https://WPISZ_WORKER/discord
```

Następnie zapisz zmiany.

Discord zweryfikuje endpoint Workera za pomocą `DISCORD_PUBLIC_KEY`.

## 7. Rejestracja komend

Po skonfigurowaniu Workera wywołaj:

```text
https://WPISZ_WORKER/register-plan?secret=TWÓJ_SETUP_SECRET
```

Worker zarejestruje komendy na wszystkich serwerach znajdujących się w `GUILD_IDS`.

Jeżeli wszystko jest poprawnie skonfigurowane, komendy pojawią się na serwerach Discord.

Dostępne komendy obejmują:

- `/plan`
- `/gra`
- `/log`
- `/xayoo`

## 8. Uprawnienia bota Discord

Podczas zapraszania bota na serwer nadaj mu odpowiednie uprawnienia.

Bot powinien mieć możliwość:

- wysyłania wiadomości,
- korzystania z komend,
- odczytywania historii wiadomości, jeśli wymaga tego dana funkcja,
- korzystania z odpowiednich kanałów.

Podczas tworzenia zaproszenia wybierz odpowiednie zakresy:

- `bot`
- `applications.commands`

## 9. Integracja ze StreamElements

Integracja ze StreamElements jest opcjonalna.

W StreamElements przejdź do:

**Chatbot → Custom Commands**

Następnie utwórz własne komendy i użyj odpowiednich endpointów Workera.

Najlepiej użyć gotowych **Command Reply**.

Adres Workera zastąp:

```text
WPISZ_WORKER
```

W komendach wymagających zabezpieczenia użyj również:

```text
MODERATOR_SECRET
```

Worker musi być publicznie dostępny przez HTTPS.

Dzięki temu StreamElements może wysyłać zapytania do Workera, a otrzymaną odpowiedź wyświetlać na czacie Twitcha.

### Zmiana planu z StreamElements

Do zmiany planu użyj:

```text
!zmiana
```

**Command Reply:**

```text
$(urlfetch https://WPISZ_WORKER/zmiana?secret=MODERATOR_SECRET&user=$(queryescape $(sender))&text=$(queryescape ${1:}))
```

Przykład:

```text
!zmiana Dzisiaj gramy Wiedźmina
```

Zmiana zostanie zapisana w KV `PARIS` i wysłana na skonfigurowane kanały Discord.

Na Discordzie pojawi się:

```text
@everyone

Plan został zmieniony przez: *nick*

Dzisiaj gramy Wiedźmina
```

### Zmiana planu z Discorda

Plan można zmienić za pomocą:

```text
/plan
```

Po zmianie z Discorda wiadomość na kanałach planu będzie wyglądała:

```text
@everyone

Dzisiaj gramy Wiedźmina
```

Nie jest dodawana informacja o osobie zmieniającej plan, ponieważ autor komendy jest widoczny bezpośrednio na Discordzie.

### Komenda Steam

Dla StreamElements użyj:

```text
!gra
```

**Command Reply:**

```text
$(urlfetch https://WPISZ_WORKER/steam?game=$(queryescape ${1:}))
```

Ważne jest użycie:

```text
${1:}
```

Dzięki temu można wyszukiwać również gry z nazwami zawierającymi więcej niż dwa słowa.

Przykłady:

```text
!gra Fez
!gra Wiedźmin 3 Dziki Gon
!gra Grand Theft Auto V
```

Na Discordzie informacje o grze można pobrać przez:

```text
/gra
```

Pozostałe komendy StreamElements korzystają z odpowiednich endpointów Workera.

## 10. Sprawdzenie konfiguracji

Po zakończeniu konfiguracji możesz sprawdzić podstawową konfigurację Workera:

```text
https://WPISZ_WORKER/config-check
```

Endpoint zwróci informacje o tym, które elementy konfiguracji są ustawione.

> Nie udostępniaj publicznie wyników zawierających informacje o swojej konfiguracji.

# Gotowe

![Zdjęcie](IMG_7178.png)
