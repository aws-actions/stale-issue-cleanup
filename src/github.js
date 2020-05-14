const github = require('@actions/github');
const log = require('loglevel').getLogger('github');

const MS_PER_DAY = 86400000;

/**
 * Closes a github issue
 * @param {github.Github} client
 * @param {object} issue
 * @param {string} cfsLabel The closing-for-staleness label
 */
module.exports.closeIssue = async (client, issue, cfsLabel) => {
  log.debug(`closing issue #${issue.number} for staleness`);
  if (cfsLabel && cfsLabel !== '') {
    await client.issues.addLabels({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      labels: [cfsLabel],
    });
  }
  await client.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    state: 'closed',
  });
};

/**
 * Removes a label from a github issue
 * @param {github.Github} client
 * @param {object} issue
 * @param {string} label
 */
module.exports.removeLabel = async (client, issue, label) => {
  log.debug(`removing label ${label} from #${issue.number}`);
  await client.issues.removeLabel({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    name: label,
  });
};

/**
 * Marks an issue as "stale"
 * @param {github.GitHub} client
 * @param {object} issue
 * @param {string} staleMessage
 * @param {string} staleLabel
 */
module.exports.markStale = async (client, issue, staleMessage, staleLabel) => {
  log.debug(`marking issue #${issue.number} as stale`);
  await client.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    body: staleMessage,
  });
  await client.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    labels: [staleLabel],
  });
};

/**
 * Helper function to get github timeline events
 * @param {github.GitHub} client A github client
 * @param {object} issue An issue object
 * @return {Promise.Array} An array of timeline events
 */
module.exports.getTimelineEvents = (client, issue) => {
  const options = client.issues.listEventsForTimeline.endpoint.merge({
    issue_number: issue.number,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    per_page: 100,
  });
  return client.paginate(options);
};

/**
 * Get the issues from GitHub
 * @param {github.GitHub} client
 * @param {Args} args Argument array
 * @return {Promise.<Array>} array of unique issues
 */
module.exports.getIssues = async (client, args) => {
  let responseIssues = [];
  let staleIssues = [];
  let stalePrs = [];
  let ancientIssues = [];

  let options = client.issues.listForRepo.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'open',
    labels: args.responseRequestedLabel,
    per_page: 100,
  });
  responseIssues = await client.paginate(options);
  log.debug(`found ${responseIssues.length} response-requested issues`);

  if (args.staleIssueMessage && args.staleIssueMessage !== '') {
    options = client.issues.listForRepo.endpoint.merge({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      labels: args.staleIssueLabel,
      per_page: 100,
    });
    staleIssues = await client.paginate(options);
    log.debug(`found ${staleIssues.length} stale issues`);
  } else {
    log.debug(`skipping stale issues due to empty message`);
  }

  if (args.stalePrMessage && args.stalePrMessage !== '') {
    options = client.issues.listForRepo.endpoint.merge({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      labels: args.stalePrLabel,
      per_page: 100,
    });
    stalePrs = await client.paginate(options);
    log.debug(`found ${stalePrs.length} stale prs`);
  } else {
    log.debug(`skipping stale PRs due to empty message`);
  }

  if (args.ancientIssueMessage && args.ancientIssueMessage !== '') {
    options = client.issues.listForRepo.endpoint.merge({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      per_page: 100,
      sort: 'updated',
      direction: 'asc',
    });
    const ancientResults = await client.paginate(options);
    ancientIssues = ancientResults.filter(
      (issue) =>
        new Date(issue.updated_at) <
        new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient)
    );
    log.debug(`found ${ancientIssues.length} ancient issues`);
  } else {
    log.debug(`skipping ancient issues due to empty message`);
  }

  const issues = [
    ...responseIssues,
    ...staleIssues,
    ...stalePrs,
    ...ancientIssues,
  ];
  return Object.values(
    issues.reduce((unique, item) => {
      unique[`${item.id}`] = item;
      return unique;
    }, [])
  );
};

/**
 * Checks if there are more upvotes than the threshold on an issue
 * @param {github.Github} client
 * @param {number} issueNumber The github issue number to check
 * @param {number} upvoteCount Number of upvotes
 * @return {bool} Whether or not there are enough upvotes
 */
module.exports.hasEnoughUpvotes = async (client, issueNumber, upvoteCount) => {
  const options = client.reactions.listForIssue.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issueNumber,
    mediaType: { previews: ['squirrel-girl-preview'] },
    per_page: 100,
  });
  reactions = await client.paginate(options);
  if (reactions) {
    reactions.unshift(0);
    const upvotes = reactions.reduce((acc, cur) => {
      if (
        cur.content === '+1' ||
        cur.content === 'heart' ||
        cur.content === 'hooray' ||
        cur.content === 'rocket'
      ) {
        return acc + 1;
      } else {
        return acc;
      }
    });
    return upvotes >= upvoteCount ? true : false;
  } else {
    return false;
  }
};
