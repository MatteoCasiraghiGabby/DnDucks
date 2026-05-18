# Character Suggestions

Edit `character-suggestions.tsv` to add or change the options used by the character suggestion workflow.

Open it with a spreadsheet app or a text editor. Keep the first header row unchanged.

Allowed `category` values:

- `backgrounds`
- `backgroundFeatures`
- `racialTraits`
- `feats`

Use a unique `id` for every row. Keep it lowercase and dash-separated, for example `feat-duelist` or `racial-trait-stonecunning`.

Use semicolons in `tags` to list the words that should trigger the suggestion:

```text
duelist; sword; noble; fencing; quick
```

After editing the file, restart the local server so the backend reloads the list.
