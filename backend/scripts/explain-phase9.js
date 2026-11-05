// Phase 9 index review: winning-plan + scan stats for the hot query shapes.
// Run: docker exec -i kms-mongo-1 mongosh --quiet kms < scripts/explain-phase9.js
function stage(plan) {
  if (!plan) return '?';
  if (plan.stage === 'FETCH') {
    const input = (plan.inputStage && plan.inputStage.stage) || '?';
    return 'FETCH<- ' + input;
  }
  return plan.stage;
}
function report(name, explain) {
  const stats = explain.executionStats || {};
  print(
    name +
      ' | plan=' +
      stage(stats.executionStages) +
      ' | nReturned=' +
      stats.nReturned +
      ' | totalDocsExamined=' +
      stats.totalDocsExamined +
      ' | totalKeysExamined=' +
      stats.totalKeysExamined +
      ' | ms=' +
      stats.executionTimeMillis,
  );
}

const kbm = db.kb_members.findOne();
if (kbm) {
  report(
    'kb_members by userId',
    db.kb_members.find({ userId: kbm.userId }).explain('executionStats'),
  );
  report(
    'kb_members by kbId',
    db.kb_members.find({ knowledgeBaseId: kbm.knowledgeBaseId }).explain('executionStats'),
  );
}

const art = db.articles.findOne();
if (art) {
  report(
    'articles list (kb+status, sort createdAt)',
    db.articles
      .find({ knowledgeBaseId: art.knowledgeBaseId, deletedAt: null, status: 'published' })
      .sort({ createdAt: -1 })
      .explain('executionStats'),
  );
  report(
    'articles $text',
    db.articles.find({ $text: { $search: 'test' } }).explain('executionStats'),
  );
  report(
    'articles regex fallback',
    db.articles
      .find({ organizationId: art.organizationId, title: /test/i })
      .explain('executionStats'),
  );
}

const rr = db.review_requests.findOne();
if (rr) {
  report(
    'review inbox (org+reviewer+status, sort)',
    db.review_requests
      .find({ organizationId: rr.organizationId, reviewerId: rr.reviewerId, status: 'pending' })
      .sort({ createdAt: -1 })
      .explain('executionStats'),
  );
}

const n = db.notifications.findOne();
if (n) {
  report(
    'notifications inbox',
    db.notifications.find({ userId: n.userId, isRead: false }).sort({ createdAt: -1 }).explain('executionStats'),
  );
}

const a = db.audit_logs.findOne();
if (a) {
  report(
    'audit logs (org, sort)',
    db.audit_logs.find({ organizationId: a.organizationId }).sort({ createdAt: -1 }).explain('executionStats'),
  );
}

const m = db.memberships.findOne();
if (m) {
  report(
    'memberships by userId',
    db.memberships.find({ userId: m.userId }).explain('executionStats'),
  );
}
