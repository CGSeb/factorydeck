# factorydeck

The command line of [FactoryDeck](https://github.com/CGSeb/factorydeck): it logs in to your team's FactoryDeck server and sends it your agent sessions.

## Install

FactoryDeck's CLI needs Node 22 or later.

```sh
npm i -g factorydeck
```

Upgrade with `npm i -g factorydeck@latest`. `factorydeck --version` prints the version of the CLI and of its parser.

## Log in

```sh
factorydeck login https://deck.example.test
```

It prints a code and opens a page of your FactoryDeck in your browser: check that the code matches and approve the login. `factorydeck status` shows the servers you are logged in to, and `factorydeck logout <url>` logs out. `factorydeck --help` lists every command.

## Documentation

Commands, files and exit codes: [docs/product/cli.md](https://github.com/CGSeb/factorydeck/blob/main/docs/product/cli.md).

## License

[MIT](LICENSE)
