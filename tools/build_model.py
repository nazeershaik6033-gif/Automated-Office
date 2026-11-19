#!/usr/bin/env python3
"""Builds src/addon/nd-model.json – the template-choice model learned from the
user's own notings. The notings themselves are PRIVATE and are never stored in
this repository: run this script locally against an evaluation set built from
them (evalset.json: [{gold, input}]), plus rules.json (public EPFO vocabulary
from the app's manuals) and items.json (to find name words).

Privacy: a word is kept only if it (a) occurs in the public EPFO manuals /
circular index embedded in the app, (b) is never used inside a person's or
company's name in the notings, (c) has no digits, and (d) occurs in at least
two different notings. So the model holds generic EPFO vocabulary only."""
import json, re, sys
from collections import Counter
S = sys.argv[1]
R = json.load(open(S + '/rules.json')); KB = set(R['kb'])
E = json.load(open(S + '/evalset.json')); I = json.load(open(S + '/items.json'))
NAMEW = set()
for it in I:
    for m in re.finditer(r"\b(?:Sri|Shri|Smt|Mr|Mrs|Ms|Kum|Late|M/s|member|deceased member|claimant|claimants|establishment|r/o)\.?\s+((?:[A-Z][A-Za-z.'’]*\s*){1,6})", it['text']):
        NAMEW.update(re.findall(r'[a-z]+', m.group(1).lower()))
NAMEW -= {'late','member','establishment','private','limited','ltd','pvt','services','india','the','and','of','in'}
STOP = 'a an the of in on at to for from by with and or is are was were be been has have had this that these those it its as per vide which who whom into than then also such any all may can will shall would should said above below please same'.split()
def toks(t):
    w = [x for x in re.findall(r'[a-z][a-z-]+', t.lower()) if x not in STOP]
    return w + [a + '_' + b for a, b in zip(w, w[1:])]
ok = lambda tok: all(p in KB and p not in NAMEW and len(p) > 1 for p in tok.split('_'))
docs = [[x for x in toks(e['input']) if ok(x)] for e in E]
df = Counter(); [df.update(set(d)) for d in docs]
V = {w for w, c in df.items() if c >= 2}
out = {'v': 1, 'k': 5, 'beta': 0.6, 'stop': STOP,
       'docs': [{'c': e['gold'], 'w': sorted(set(x for x in d if x in V))} for e, d in zip(E, docs)]}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print(len(out['docs']), 'examples,', len(V), 'words ->', sys.argv[2])
