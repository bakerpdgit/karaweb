# Saving & sharing your challenge book

When your book is ready, click **💾 Save** in the header. You
get a plain `.json` file you can keep, version-control, or
distribute however suits your school.

## The file format

The file is human-readable JSON tagged with a schema version
(currently `karaWebVersion: 5`). Older karaweb versions read
newer files where possible, falling back to defaults for
fields they don't know about — so you don't break pupils on
slightly older clients.

A challenge book file contains:

- Every challenge (worlds, code, notes, configuration)
- A book-level GUID (so cloud-save submissions can be
  attributed to this specific book)
- Optionally a cloud-save block embedding your backend URL +
  public key (see [Cloud save](?tutorial=cloud-save))
- Optionally the teacher-level keydetails public key
- _Not_ your private key, your class lists, or any pupil data

You can edit the JSON by hand if you really want to — but
the in-app editor is faster for everything except the most
mechanical bulk changes.

## Distribution options

### A. Direct file share

The simplest: email the `.json`, drop it on a shared drive,
upload it to your school's VLE, hand it out on a memory stick.
Pupils click **📁 Open** in karaweb and pick the file. Works
fully offline once karaweb itself is loaded.

### B. GitHub-hosted share link

If you keep your books in a public GitHub repo (or as Gists),
karaweb can load them directly via a deep-link in the URL:

```
https://karaweb.classinteractives.co.uk/?challenges=<encoded-URL>
```

The `<encoded-URL>` is the URL-encoded raw URL of your
challenge file. Either a GitHub `raw.githubusercontent.com`
URL or a normal `github.com/USER/REPO/blob/...` URL works
(karaweb normalises `blob/` → raw automatically). Same for
Gists.

**Use the file's full commit / tag URL, not `main`**. If you
link to `main` and edit the file later, every pupil's link
loads the new version — which silently invalidates their
in-progress work. Pin to a tag like `v1.0` or a specific
commit SHA so the book is immutable for the term you set it.

### C. Combine: share-link distribution + cloud-save submissions

The two are complementary. The deep-link is how pupils _get_
the book; cloud save (see next chapter) is how their attempts
come _back_ to you.

## What the pupil sees when they open a book

The challenges list replaces the default "Examples" content.
Pupils can:

- Switch between challenges freely
- Read the Notes for each
- Submit attempts (📡 if cloud-save is on; just keep working
  locally if it's not)
- Save their own world + work to a local file as a backup

They can _not_ edit the book itself — the **Editing
challenges** view is hidden unless they have your keydetails
file (which they shouldn't).

Next: [Cloud save — how it works](?tutorial=cloud-save).
