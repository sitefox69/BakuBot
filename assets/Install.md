![Zdjęcie](assets/IMG_7160.png)

# Wymagania

Przed rozpoczęciem przygotuj:

* Konto [GitHub](https://github.com/)
* Konto [Cloudflare](https://dash.cloudflare.com/)
* Aplikację Discord stworzoną w [Discord Developer Portal](https://discord.com/developers/applications)
* Konto [StreamElements](https://streamelements.com/)  
```Opcjonalnie, jeśli chcesz korzystać z integracji z Twitch```
* Repozytorium tego projektu

---

## 1. Pobranie projektu

Sklonuj repozytorium:

```bash
git clone https://github.com/sitefox69/Bakubottest.git
cd Bakubottest
```

Możesz również pobrać repozytorium jako ZIP z GitHuba.

---

## 2. Utworzenie aplikacji Discord

Wejdź do **Discord Developer Portal** i utwórz nową aplikację.

Następnie:

1. Wejdź w **Bot**.
2. Utwórz bota.
3. Skopiuj **Bot Token**.
4. Wejdź w **General Information**.
5. Skopiuj:

   * `Application ID`
   * `Public Key`

> **Nigdy nie udostępniaj Bot Tokena.** Jest to poufny klucz dostępu do Twojego bota.

---

## 3. Utworzenie Workera

Zaloguj się do **Cloudflare** i przejdź do **Workers & Pages**.

Utwórz nowego Workera, a następnie wgraj pliki projektu:

```text
worker.js
modules/
├── index.js
├── steam.js
└── ttv.js
```

Worker musi być dostępny pod publicznym adresem HTTPS.

Przykład:

```text
https://twoj-worker.workers.dev
```

---

## 4. Utworzenie KV

Worker korzysta z **Cloudflare KV** do przechowywania aktualnego tekstu.

W Cloudflare:

**Storage & databases → Workers KV → Create Instance**

```text
Instance name: PARIS
```
Po dodaniu przejdzie do:

**Compute → Workers & Pages → Twój_Worker → Bindings → Add binding**

Następnie dodaj **KV namespace** do Workera.

Nazwa **Variable Name** musi być dokładnie:

```text
Variable Name: PARIS
```
---

## 5. Konfiguracja zmiennych

W ustawieniach Workera przejdź do:

**Settings → Variables and Secrets**

Dodaj:

| Nazwa                | Wartość                                     |
| -------------------- | ------------------------------------------- |
| `DISCORD_TOKEN`      | Token bota Discord                          |
| `DISCORD_PUBLIC_KEY` | Public Key aplikacji Discord                |
| `APPLICATION_ID`     | Application ID aplikacji Discord            |
| `GUILD_IDS`          | ID serwerów Discord, oddzielone przecinkami |
| `CHANNEL_IDS`        | ID kanałów Discord, oddzielone przecinkami  |
| `MODERATOR_SECRET`   | Własny sekret do zmiany tekstu              |
| `SETUP_SECRET`       | Własny sekret do rejestracji komend         |

Przykład:

```text
GUILD_IDS=123456789012345678,987654321098765432
CHANNEL_IDS=123456789012345678,987654321098765432
```

### Sekrety

Następujące wartości powinny być ustawione jako **Secrets**:

```text
DISCORD_TOKEN
MODERATOR_SECRET
SETUP_SECRET
```

Nie umieszczaj ich bezpośrednio w kodzie ani w publicznym repozytorium.

---

## 6. Ustawienie Discord Interactions

W **Discord Developer Portal** otwórz swoją aplikację.

Przejdź do:

**General Information → Interactions Endpoint URL**

Wpisz:

```text
https://WPISZ_WORKER/discord
```

Następnie zapisz zmiany.

Discord zweryfikuje endpoint Workera za pomocą `DISCORD_PUBLIC_KEY`.

---

## 7. Rejestracja komend

Po skonfigurowaniu Workera wywołaj:

```text
https://WPISZ_WORKER/register-plan?secret=TWÓJ_SETUP_SECRET
```

Worker zarejestruje komendy na wszystkich serwerach znajdujących się w:

```text
GUILD_IDS
```

Jeżeli wszystko jest poprawnie skonfigurowane, komendy pojawią się na serwerach Discord.

---

## 8. Uprawnienia bota Discord

Podczas zapraszania bota na serwer nadaj mu odpowiednie uprawnienia.

Bot powinien mieć możliwość:

* wysyłania wiadomości,
* korzystania z komend,
* odczytywania historii wiadomości, jeśli wymaga tego dana funkcja,
* korzystania z odpowiednich kanałów.

Podczas tworzenia zaproszenia wybierz odpowiednie zakresy:

```text
bot
applications.commands
```

---

## 9. Integracja ze StreamElements

Integracja ze StreamElements jest opcjonalna.

W StreamElements przejdź do:

**Chatbot → Custom Commands**

Następnie utwórz własne komendy i użyj odpowiednich endpointów Workera.

Najlepiej użyć gotowych -> [Command Reply](https://sitefox.gitbook.io/bakubot-1/komendy-discord)

Adres Workera zastąp:

```text
WPISZ_WORKER oraz MODERATOR_SECRET
```

Worker musi być publicznie dostępny przez HTTPS.

Dzięki temu StreamElements może wysyłać zapytania do Workera, a otrzymaną odpowiedź wyświetlać na czacie Twitcha.

---

## 10. Sprawdzenie konfiguracji

Po zakończeniu konfiguracji możesz sprawdzić podstawową konfigurację Workera:

```text
https://WPISZ_WORKER/config-check
```

Endpoint zwróci informacje o tym, które elementy konfiguracji są ustawione.

> Nie udostępniaj publicznie wyników zawierających informacje o swojej konfiguracji.

# Gotowe


