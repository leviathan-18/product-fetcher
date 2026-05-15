const jobs = new Map();

function createJob(initialState) {
  jobs.set(initialState.jobId, { ...initialState });
  return jobs.get(initialState.jobId);
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function updateJob(jobId, patch) {
  const currentJob = jobs.get(jobId);
  if (!currentJob) {
    return null;
  }
  const nextJob = { ...currentJob, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(jobId, nextJob);
  return nextJob;
}

module.exports = {
  createJob,
  getJob,
  updateJob,
};