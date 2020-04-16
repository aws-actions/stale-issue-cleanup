const log = require('loglevel').getLogger('utils');

/**
 * Determines if an issue is labelled with the given label
 * @param {object} issue An issue object
 * @param {string} label The label to check
 * @return {bool} true if the issue has this label on it
 */
module.exports.isLabeled = (issue, label) => {
  if ('labels' in issue) {
    const foundone = issue.labels.some((labelObj) => labelObj.name === label);
    if (foundone) {
      log.debug(`issue has label ${label}`);
    } else {
      log.debug(`issue doesn't have ${label}`);
    }
    return foundone;
  } else {
    log.debug(`no labels detail in ${issue.number}`);
    return false;
  }
};

/**
 * Function for date comparison
 * @param {*} eventa Date representation in Date.parseable format
 * @param {*} eventb Date representation in Date.parseable format
 * @return {number} 1 if A < B, else -1
 */
const revCompareEventsByDate = (eventa, eventb) => {
  const dateA = Date.parse(eventa.created_at);
  const dateB = Date.parse(eventb.created_at);
  if (dateA < dateB) {
    return 1;
  } else {
    return -1;
  }
};
module.exports.revCompareEventsByDate = revCompareEventsByDate;

/**
 * Gets last label time from a timeline event array
 * @param {Array} events Array of timeline events from GitHub
 * @param {string} label Label text
 * @return {Date} Date of last label time
 */
module.exports.getLastLabelTime = (events, label) => {
  const labelEvents = events.filter((event) => event.event === 'labeled');
  const searchLabelEvents = labelEvents.filter((event) => {
    return event.label.name === label;
  });
  searchLabelEvents.sort(revCompareEventsByDate);
  return Date.parse(searchLabelEvents[0].created_at);
};

/**
 * Gets the last comment time on an issue timeline,
 * or if no comments, the last event time
 * @param {Array} events Array of issue timeline events
 * @return {Date} Date object of last event
 */
module.exports.getLastCommentTime = (events) => {
  const commentEvents = events.filter((event) => event.event === 'commented');
  if (commentEvents.length > 0) {
    log.debug(`issue has some comments`);
    commentEvents.sort(revCompareEventsByDate);
    log.debug(`newest event is ${commentEvents[0].created_at}`);
    return Date.parse(commentEvents[0].created_at);
  } else {
    // No comments on issue, so use *all events*
    log.debug(`issue has no comments`);
    events.sort(revCompareEventsByDate);
    log.debug(`newest event is ${events[0].created_at}`);
    return Date.parse(events[0].created_at);
  }
};

/**
 * Run foreach on array async
 * @param {Array} array Array of values
 * @param {function} callback Callback function
 */
module.exports.asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
