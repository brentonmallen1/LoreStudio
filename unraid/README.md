# Unraid templates

Container templates for running LoreStudio on Unraid from the published images.

## All-in-one (recommended)

- [`lorestudio.xml`](lorestudio.xml): the app and its web interface in **one container**
  (`ghcr.io/brentonmallen1/lorestudio`). One port, one appdata folder, nothing else to set up.

## Two containers

- [`lorestudio-backend.xml`](lorestudio-backend.xml): the API (`ghcr.io/brentonmallen1/lorestudio-backend`)
- [`lorestudio-frontend.xml`](lorestudio-frontend.xml): the web interface, proxying `/api` to the API
  (`ghcr.io/brentonmallen1/lorestudio-frontend`)

Both join a custom network: `docker network create lorestudio` once, then install the backend,
then the frontend (it has the WebUI, default port 8480).

## Adding the templates

**Template repository.** In Unraid: *Docker → Template Repositories* (bottom of the page), add

```
https://github.com/brentonmallen1/LoreStudio
```

and the templates appear under *Add Container → Template*.

**By hand.** Copy the XML files to `/boot/config/plugins/dockerMan/templates-user/` on the
Unraid box.

The full walkthrough (Ollama on the same server, backups, updating) is
[docs/unraid.md](../docs/unraid.md).

Templates live in the app repository and point at themselves through `<TemplateURL>`; if they
move to their own repository or to Community Applications, update those URLs.
