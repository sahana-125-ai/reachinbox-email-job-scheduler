import type { EmailRecord, SearchQuery } from './types.ts';

interface IndexedDoc {
  id: string;
  email: EmailRecord;
  tokens: Set<string>;
  rawTokens: string[];
}

export class EmailSearchEngine {
  private documents = new Map<string, IndexedDoc>();
  private invertedIndex = new Map<string, Set<string>>(); // token -> docId set

  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s@.-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  public indexEmail(email: EmailRecord): void {
    // Remove previous version if already present
    this.removeEmail(email.id);

    const fullText = `${email.recipient_email} ${email.sender_email} ${email.subject} ${email.body} ${email.status}`;
    const rawTokens = this.tokenize(fullText);
    const tokenSet = new Set(rawTokens);

    // Also add sub-tokens for emails (e.g. "john" from "john@domain.com")
    for (const token of rawTokens) {
      if (token.includes('@')) {
        const parts = token.split('@');
        tokenSet.add(parts[0]);
        tokenSet.add(parts[1]);
      }
      // Add prefixes for search-as-you-type (min 3 chars)
      if (token.length >= 3 && token.length <= 15) {
        for (let i = 3; i <= token.length; i++) {
          tokenSet.add(token.substring(0, i));
        }
      }
    }

    const doc: IndexedDoc = {
      id: email.id,
      email,
      tokens: tokenSet,
      rawTokens,
    };

    this.documents.set(email.id, doc);

    for (const token of tokenSet) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(email.id);
    }
  }

  public removeEmail(id: string): void {
    const existing = this.documents.get(id);
    if (!existing) return;

    for (const token of existing.tokens) {
      const set = this.invertedIndex.get(token);
      if (set) {
        set.delete(id);
        if (set.size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }
    this.documents.delete(id);
  }

  public search(query: SearchQuery): {
    total: number;
    hits: Array<{ email: EmailRecord; score: number; highlights?: Record<string, string[]> }>;
  } {
    const q = (query.q || '').trim().toLowerCase();
    const queryTokens = this.tokenize(q);

    let candidates: EmailRecord[] = [];

    if (queryTokens.length === 0) {
      // Return all documents matching filters
      candidates = Array.from(this.documents.values()).map((d) => d.email);
    } else {
      // Score documents matching any or all query tokens
      const scoredDocs = new Map<string, number>();

      for (const token of queryTokens) {
        // Exact token matches
        const matches = this.invertedIndex.get(token);
        if (matches) {
          for (const docId of matches) {
            scoredDocs.set(docId, (scoredDocs.get(docId) || 0) + 3.0);
          }
        }

        // Substring / prefix matches across tokens
        for (const [idxToken, docIdSet] of this.invertedIndex.entries()) {
          if (idxToken.includes(token) && idxToken !== token) {
            for (const docId of docIdSet) {
              scoredDocs.set(docId, (scoredDocs.get(docId) || 0) + 1.0);
            }
          }
        }
      }

      // Sort by score descending
      const sorted = Array.from(scoredDocs.entries()).sort((a, b) => b[1] - a[1]);
      candidates = sorted
        .map(([id]) => this.documents.get(id)?.email)
        .filter((e): e is EmailRecord => Boolean(e));
    }

    // Apply filters
    let filtered = candidates;

    if (query.status && query.status !== 'all') {
      filtered = filtered.filter((e) => e.status === query.status);
    }

    if (query.sender) {
      filtered = filtered.filter((e) =>
        e.sender_email.toLowerCase().includes(query.sender!.toLowerCase())
      );
    }

    if (query.recipient) {
      filtered = filtered.filter((e) =>
        e.recipient_email.toLowerCase().includes(query.recipient!.toLowerCase())
      );
    }

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paged = filtered.slice(offset, offset + limit);

    const hits = paged.map((email) => {
      // Calculate highlight matches if query provided
      const highlights: Record<string, string[]> = {};
      if (q) {
        if (email.subject.toLowerCase().includes(q)) {
          highlights.subject = [email.subject.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>')];
        }
        if (email.body.toLowerCase().includes(q)) {
          const idx = email.body.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 40);
          const end = Math.min(email.body.length, idx + q.length + 40);
          const snippet = (start > 0 ? '...' : '') +
            email.body.substring(start, end).replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>') +
            (end < email.body.length ? '...' : '');
          highlights.body = [snippet];
        }
      }

      return {
        email,
        score: 1.0,
        highlights: Object.keys(highlights).length > 0 ? highlights : undefined,
      };
    });

    return { total, hits };
  }

  // Elasticsearch DSL compatibility endpoint serializer
  public toElasticsearchResponse(
    query: SearchQuery,
    tookMs = 2
  ) {
    const results = this.search(query);
    return {
      took: tookMs,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: {
        total: { value: results.total, relation: 'eq' },
        max_score: results.hits.length > 0 ? results.hits[0].score : null,
        hits: results.hits.map((h) => ({
          _index: 'emails',
          _id: h.email.id,
          _score: h.score,
          _source: h.email,
          highlight: h.highlights,
        })),
      },
    };
  }
}

export const searchEngine = new EmailSearchEngine();
