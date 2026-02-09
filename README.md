# init-gba

A CLI that bootstraps a GBA game project with [Butano](https://github.com/GValiente/butano).

## Important

This has only been tested on macOS. Windows and Linux support is not guaranteed, but contributions to make it work on those platforms are welcome.

## Why

Setting up a GBA project with Butano involves cloning repos, wiring up Makefiles, setting paths, and renaming template files. This tool does all of that in one command.

## Install

```sh
npm install -g init-gba
```

## Usage

### `init-gba create`

Creates a new GBA project from a Butano template.

```sh
init-gba create
```

This will interactively ask you for a project name, directory, Butano path, and other options.

#### Non-interactive

```sh
init-gba create --name my-game --non-interactive
```

#### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--name`, `-n` | string | | Game name |
| `--dir` | string | `./<name>` | Target directory for the project |
| `--butano-path` | string | `~/Documents/butano` | Butano installation path |
| `--butano-repo` | string | `https://github.com/GValiente/butano.git` | Butano git repository URL |
| `--template-path` | string | `<butano-path>/template` | Path to the template folder |
| `--template-token` | string | `template` | Template token to replace in files |
| `--rom-title` | string | derived from name | ROM title (uppercase, max 12 chars) |
| `--rom-code` | string | derived from name | ROM code (4 uppercase characters) |
| `--force` | boolean | `false` | Overwrite target directory if it exists |
| `--non-interactive` | boolean | `false` | Fail if required input is missing |
| `--yes`, `-y` | boolean | `false` | Accept defaults and skip prompts |
| `--skip-deps` | boolean | `false` | Skip devkitPro dependency checks |
| `--skip-git` | boolean | `false` | Skip git init |
| `--skip-makefile` | boolean | `false` | Skip Makefile generation |
| `--skip-update` | boolean | `false` | Skip checking for Butano updates |

#### Examples

Create a project with defaults in the current directory:

```sh
init-gba create --name my-game --yes
```

Specify a custom Butano path and skip dependency checks:

```sh
init-gba create --name my-game --butano-path ~/butano --skip-deps
```

Set ROM metadata directly:

```sh
init-gba create --name my-game --rom-title "COOL GAME" --rom-code COOL --non-interactive
```

### `init-gba doctor`

Checks your environment for common Butano/devkitPro issues.

```sh
init-gba doctor
```


## License

[MIT](LICENSE)
