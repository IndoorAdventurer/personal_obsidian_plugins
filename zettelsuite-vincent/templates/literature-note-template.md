---
note-type: literature-note
tags:
  - literature-note
  - zettelkasten{{tags}}
created: {{today}}
literature-type: {{lit_type}}
annotations: {{annotations_file}}
title: {{title}}
authors: {{authors}}
published: {{pubdate}}
reading-status:
rating (0-10):
---
**Checklist**
- [ ] Title is of the form Author's last name, Title, Year
- [ ] Added appropriate tags
- [ ] Put main ideas in separate permanent notes and link them here
- [ ] Remove this checklist
# {{file_name}}
> [!tldr] Abstract
> Abstract here
## Why I started reading this paper
Give some context, so later you understand why you looked up this paper and decided reading it would be a good idea. If it's not a paper, change it to something else, of course.
## Main Summary
General summary of the paper/book/etc. For some ideas you might want to create permanent notes and link to them directly.
## Reflections and Relevant Points
### General
Write some general comments on this paper, or some specific points you want to highlight.
### Relevant references
List some references this paper mentioned that are important for you.
## Mentions
Places where this source gets mentioned.
```dataview
LIST
FROM [[]]
WHERE contains(file.outlinks, this.file.link)
SORT file.name DESC
```
## Resources
### BibTex
```BibTex
{{bibtex}}
```
### Links
Extra links here. Else delete