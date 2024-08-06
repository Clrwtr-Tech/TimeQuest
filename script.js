let HOURS_IN_WORKDAY = 8;
let TOKENS_PER_DAY = 16;
let HOURS_PER_TOKEN = HOURS_IN_WORKDAY / TOKENS_PER_DAY;

let displayDate = new Date();
let userDetails;
let username;

const BADGE_LEVELS = [50, 250, 500, 1000, 2000, 4000];
const BADGE_EMOJIS = ['🥉', '🥈', '🥇', '🏅', '🏆', '🎖️'];
const notificationQueue = [];
let isNotificationActive = false;

function updateGlobalConstants(user) {
    HOURS_IN_WORKDAY = user.workday;
    HOURS_PER_TOKEN = parseFloat(user.unittime);
    TOKENS_PER_DAY = HOURS_IN_WORKDAY / HOURS_PER_TOKEN;
}

// Define functions globally or at the top level
function updateDateDisplay() {
    const dateDisplay = document.getElementById('date-display');
    const dateContainer = document.getElementById('date-container');
    if (!dateDisplay || !dateContainer) {
        console.error('Date display or container element not found.');
        return;
    }

    const options = { month: 'short', day: 'numeric' };
    dateDisplay.textContent = displayDate.toLocaleDateString('en-US', options);

    const dayOfWeek = displayDate.getDay(); // 0 (Sunday) to 6 (Saturday)
    const workweek = userDetails.workweek || 'monday,tuesday,wednesday,thursday,friday'; // Default workweek as string

    // Map day names to numbers
    const dayMap = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
    };

    // Convert workweek string to array of numbers
    const workweekArray = workweek.toLowerCase().split(',').map(day => dayMap[day.trim()]);

    // Check if the current day is a non-working day
    const isNonWorkingDay = !workweekArray.includes(dayOfWeek);

    // Check if the current date is today
    const today = new Date();
    const isToday = displayDate.toDateString() === today.toDateString();

    // Check if the current date is a future date
    const isFutureDate = displayDate > today;

    // Apply appropriate class based on the checks
    if (isNonWorkingDay) {
        dateContainer.classList.remove('working-day', 'today', 'future-date');
        dateContainer.classList.add('non-working-day');
    } else if (isToday) {
        dateContainer.classList.remove('non-working-day', 'future-date');
        dateContainer.classList.add('working-day', 'today');
    } else if (isFutureDate) {
        dateContainer.classList.remove('non-working-day', 'today');
        dateContainer.classList.add('working-day', 'future-date');
    } else {
        dateContainer.classList.remove('non-working-day', 'today', 'future-date');
        dateContainer.classList.add('working-day');
    }
}

function isToday(someDate) {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
        someDate.getMonth() === today.getMonth() &&
        someDate.getFullYear() === today.getFullYear();
}

function changeDate(days) {
    displayDate.setDate(displayDate.getDate() + days);
    updateDateDisplay();
    updateProjects(displayDate, userDetails);
    updateTokenOverview(displayDate, userDetails);
}

// Event listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const prevArrow = document.getElementById('prev-arrow');
    const nextArrow = document.getElementById('next-arrow');
    const loadingOverlay = document.getElementById('loading-overlay'); // Get the overlay element

    const loginData = JSON.parse(localStorage.getItem('loginData'));

    if (loginData) {
        const currentTime = new Date().getTime();
        const loginTime = loginData.loginTime;
        const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000;

        if (currentTime - loginTime < sevenDaysInMilliseconds) {
            username = loginData.username;
            loginContainer.style.display = 'none';
            loadingOverlay.style.display = 'flex'; // Show loading overlay and spinner
            await initializeApp();
            loadingOverlay.style.display = 'none'; // Hide loading overlay and spinner
        } else {
            localStorage.removeItem('loginData');
            loginContainer.style.display = 'block';
        }
    } else {
        loginContainer.style.display = 'block';
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const enteredUsername = document.getElementById('username').value;
        const enteredPassword = document.getElementById('password').value;

        loadingOverlay.style.display = 'flex'; // Show loading overlay and spinner

        // Authenticate user
        const isAuthenticated = await authenticateUser(enteredUsername, enteredPassword);

        if (isAuthenticated) {
            username = enteredUsername; // Commit the username
            loginContainer.style.display = 'none';

            // Initialize the app after successful login
            await initializeApp();
            loadingOverlay.style.display = 'none'; // Hide loading overlay and spinner
        } else {
            alert('Invalid username or password');
            loadingOverlay.style.display = 'none'; // Hide loading overlay and spinner
        }
    });

    prevArrow.addEventListener('click', () => changeDate(-1));
    nextArrow.addEventListener('click', () => changeDate(1));
});

async function initializeApp() {
    const userContainer = document.getElementById('user-container');

    if (username) {
        console.log(`The current user is: ${username}`);
        const usersData = await fetchUsers();

        // Find the user with the specified username
        const user = usersData.list.find(u => u.username === username);

        if (user) {
            userDetails = await fetchUserById(user.Id);
            userDetails.notifiedBadges = user.notifiedBadges || ''; // Ensure notifiedBadges is initialized
            updateGlobalConstants(userDetails); // Update global constants based on user details
            displayUserData(userDetails, userContainer);
            
            // Set initial date display
            updateDateDisplay();

            // Fetch and update projects and token overview initially
            await updateProjects(displayDate, userDetails);
            await updateTokenOverview(displayDate, userDetails);

            // Check hearts penalty
            await checkHeartsPenalty();

            // Check and update badges
            await checkAndUpdateBadges();

            // Initialize modal functionality
            initializeModal();
        } else {
            userContainer.textContent = 'User not found';
        }
    } else {
        userContainer.textContent = 'No username entered';
    }
}

async function authenticateUser(username, password) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records?where=(username,eq,${username})`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        }
    });

    if (!response.ok) {
        console.error('Failed to fetch user data');
        return false;
    }

    const data = await response.json();
    const user = data.list[0];

    if (user && user.Password === password) {
        const loginData = {
            username: user.username,
            loginTime: new Date().getTime()
        };
        localStorage.setItem('loginData', JSON.stringify(loginData));
        return true;
    }

    return false;
}

function displayUserData(user, container) {
    container.innerHTML = ''; // Clear any existing content

    const userImage = document.createElement('img');
    if (user.profileimage && user.profileimage.length > 0) {
        const profileImageData = user.profileimage[0];
        const baseUrl = 'https://nocodb-production-fc9f.up.railway.app/'; // Replace with the actual base URL for your images
        const imageUrl = baseUrl + profileImageData.path; // Or use signedPath if needed

        userImage.src = imageUrl;
    } else {
        userImage.src = 'default-profile-image-url'; // Fallback to a default image URL if profileimage is not available
    }
    userImage.alt = user.username;

    const userInfo = document.createElement('div');
    userInfo.classList.add('user-info');

    const username = document.createElement('h2');
    username.textContent = user.username;

    const detailsContainer = document.createElement('div');
    detailsContainer.classList.add('details-container');

    const heartsContainer = document.createElement('div');
    heartsContainer.classList.add('hearts-container');
    const totalHearts = 5;
    const redHeartCount = user.Hearts;

    for (let i = 0; i < totalHearts; i++) {
        const heart = document.createElement('span');
        heart.textContent = i < redHeartCount ? '❤️' : '🖤';
        heart.classList.add('heart');
        heartsContainer.appendChild(heart);
    }

    const pointsContainer = document.createElement('div');
    pointsContainer.classList.add('points');
    const pointsIcon = document.createElement('span');
    pointsIcon.textContent = '⭐';
    const pointsText = document.createElement('span');
    pointsText.textContent = user.Points;

    pointsContainer.appendChild(pointsIcon);
    pointsContainer.appendChild(pointsText);

    detailsContainer.appendChild(heartsContainer);
    detailsContainer.appendChild(pointsContainer);

    userInfo.appendChild(username);
    userInfo.appendChild(detailsContainer);

    container.appendChild(userImage);
    container.appendChild(userInfo);
}

async function updateProjects(displayDate, userDetails) {
    const projectsContainer = document.getElementById('projects-container');
    //console.log('Project ID:', userDetails.nc_da8u___nc_m2m_syauur8821s); // Log the ProjectID

    const projects = userDetails.nc_da8u___nc_m2m_syauur8821s
        .filter(link => link.Projects && !link.Projects.Archived)
        .map(link => link.Projects);

    const currentDate = new Date();
    const daysAgo = Math.floor((currentDate - displayDate) / (1000 * 60 * 60 * 24));

    // Fetch token counts and update the project cards
    for (const project of projects) {
        
        if (project.ProjectID) {
            const tokenCountData = await fetchTokenCounts(project.ProjectID, userDetails.UserID, daysAgo);
            project.Tokens = tokenCountData.count;
        } else {
            console.error('ProjectID is undefined for project:', project);
        }
    }

    displayProjects(projects, projectsContainer);
}

function displayProjects(projects, container) {
    container.innerHTML = ''; // Clear any existing content

    if (!Array.isArray(projects)) {
        console.error('Expected an array of projects, but received:', projects);
        return;
    }

    projects.forEach((project, index) => {
        if (!project || !project.Name) {
            console.error(`Invalid project object at index ${index}:`, project);
            return;
        }

        const projectElement = document.createElement('div');
        projectElement.classList.add('project-card');
        projectElement.addEventListener('click', () => handleProjectClick(project));

        const projectName = document.createElement('h3');
        projectName.textContent = project.Name;

        const projectTokens = document.createElement('p');
        projectTokens.innerHTML = `💰 x${project.Tokens}`;

        projectElement.appendChild(projectName);
        projectElement.appendChild(projectTokens);

        container.appendChild(projectElement);
    });
}



async function handleProjectClick(project) {
    const tokenType = isToday(displayDate) ? 'Ontime' : 'Late';
    const timezoneOffset = displayDate.getTimezoneOffset() * 60000; // Offset in milliseconds
    const localDate = new Date(displayDate.getTime() - timezoneOffset);
    const startDateTime = localDate.toISOString().slice(0, 16).replace('T', ' ');

    // Prepare the token data
    const tokenData = {
        Duration: HOURS_PER_TOKEN,
        start: startDateTime,
        nc_da8u___Users_id: userDetails.Id,
        TokenType: tokenType,
        nc_da8u___Projects_id: project.Id
    };

    // Save current token counts for revert if needed
    const currentTokenCount = project.Tokens;
    const currentPoints = userDetails.Points;

    // Show syncing message immediately
    const totalHoursText = document.getElementById('total-hours');
    totalHoursText.textContent = 'Syncing...';

    // Optimistically update the UI
    updateUIOnProjectClick(project, tokenType);

    // Send the token data to the server
    try {
        await sendTokenData(tokenData);

        // Update user points (Optimistically updated earlier)
        const points = tokenType === 'Ontime' ? 2 : 1;
        userDetails.Points += points;

        // Persist the points update to the server
        await updateUserPoints(userDetails.Id, userDetails.Points);
    } catch (error) {
        // Revert the UI changes in case of error
        console.error('Failed to send token data:', error);
        revertUIOnProjectClick(project, tokenType, currentTokenCount, currentPoints);
        alert('Failed to update project. Please try again.');
    }

    // Update projects and token overview
    await updateProjects(displayDate, userDetails);
    await updateTokenOverview(displayDate, userDetails);
}

function updateUIOnProjectClick(project, tokenType) {
    // Update the project token count optimistically
    project.Tokens += 1;

    // Get the projects array correctly
    const projects = userDetails.nc_da8u___nc_m2m_syauur8821s
        .map(link => link.Projects)
        .filter(p => p); // Filter out any undefined projects

    if (!Array.isArray(projects) || projects.length === 0) {
        console.error('Expected a valid array of projects, but received:', projects);
        return;
    }

    displayProjects(projects, document.getElementById('projects-container'));

    // Update the token overview display optimistically
    updateTokenDisplay(tokenType, true);

    // Update points display optimistically
    const points = tokenType === 'Ontime' ? 2 : 1;
    updatePointsDisplay(userDetails.Points + points);
}

function revertUIOnProjectClick(project, tokenType, originalTokenCount, originalPoints) {
    // Revert the project token count
    project.Tokens = originalTokenCount;

    // Get the projects array correctly
    const projects = userDetails.nc_da8u___nc_m2m_syauur8821s
        .map(link => link.Projects)
        .filter(p => p); // Filter out any undefined projects

    if (!Array.isArray(projects) || projects.length === 0) {
        console.error('Expected a valid array of projects, but received:', projects);
        return;
    }

    displayProjects(projects, document.getElementById('projects-container'));

    // Revert the token overview display
    updateTokenDisplay(tokenType, false);

    // Revert points display
    updatePointsDisplay(originalPoints);
}


function updateTokenDisplay(tokenType, isAdding) {
    const tokenOverview = document.getElementById('token-overview');
    const tokens = Array.from(tokenOverview.children);

    if (isAdding) {
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].textContent === '⚪') {
                tokens[i].textContent = tokenType === 'Ontime' ? '🟡' : '🔵';
                break;
            }
        }
    } else {
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i].textContent === '🟡' || tokens[i].textContent === '🔵') {
                tokens[i].textContent = '⚪';
                break;
            }
        }
    }
}


function isToday(someDate) {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
        someDate.getMonth() === today.getMonth() &&
        someDate.getFullYear() === today.getFullYear();
}

async function sendTokenData(tokenData) {
    const url = `${baseUrls.tokenCounts.replace('/count', '')}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(tokenData)
    });

    if (!response.ok) {
        throw new Error('Failed to send token data');
    }

    return await response.json();
}

async function updateTokenOverview(displayDate, userDetails) {
    const tokenOverview = document.getElementById('token-overview');
    const totalHoursText = document.getElementById('total-hours');

    // Show syncing message
    totalHoursText.textContent = 'Syncing...';

    const currentDate = new Date();
    const daysAgo = Math.floor((currentDate - displayDate) / (1000 * 60 * 60 * 24));

    try {
        const tokenCounts = await fetchDetailedTokenCountsByDate(userDetails.UserID, daysAgo);
        
        const ontimeCount = tokenCounts.Ontime || 0;
        const lateCount = tokenCounts.Late || 0;
        const ptoCount = tokenCounts.Pto || 0;
        const totalUsedTokens = ontimeCount + lateCount + ptoCount;
        const totalHoursTracked = totalUsedTokens * HOURS_PER_TOKEN;

        // Update token display
        while (tokenOverview.children.length < TOKENS_PER_DAY) {
            const tokenElement = document.createElement('span');
            tokenElement.classList.add('token');
            tokenOverview.appendChild(tokenElement);
        }

        for (let i = 0; i < TOKENS_PER_DAY; i++) {
            const tokenElement = tokenOverview.children[i];

            if (i < ontimeCount) {
                tokenElement.textContent = '🟡';
            } else if (i < ontimeCount + lateCount) {
                tokenElement.textContent = '🔵';
            } else if (i < ontimeCount + lateCount + ptoCount) {
                tokenElement.textContent = '🟢';
            } else {
                tokenElement.textContent = '⚪';
            }
        }

        // Update total hours text
        totalHoursText.textContent = `Total hours tracked: ${totalHoursTracked.toFixed(1)} hours`;
    } catch (error) {
        console.error('Failed to update token overview:', error);
        totalHoursText.textContent = 'Failed to sync';
    }
}


async function updateUserPoints(userId, newPoints) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
    const patchData = {
        Id: userId,
        Points: newPoints
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(patchData)
    });

    if (!response.ok) {
        throw new Error('Failed to update user points');
    }

    return await response.json();
}

function updatePointsDisplay(newPoints) {
    const pointsContainer = document.querySelector('.points span:last-child');
    if (pointsContainer) {
        pointsContainer.textContent = newPoints;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const editButton = document.getElementById('edit-button');
    const undoContainer = document.getElementById('undo-container');
    const undoButton = document.getElementById('undo-button');
    const newProjectButton = document.getElementById('new-project-button');
    const newProjectModal = document.getElementById('new-project-modal');
    const closeModalButton = document.querySelector('.close-button');
    const newProjectForm = document.getElementById('new-project-form');

    // Initially hide the undo container and modal
    undoContainer.style.display = 'none';
    newProjectModal.style.display = 'none';

    editButton.addEventListener('click', () => {
        editButton.classList.toggle('active');
        toggleEditMode();
    });

    undoButton.addEventListener('click', async () => {
        await removeLastToken(userDetails.Id);
    });

    newProjectButton.addEventListener('click', () => {
        newProjectModal.style.display = 'block';
    });

    closeModalButton.addEventListener('click', () => {
        newProjectModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === newProjectModal) {
            newProjectModal.style.display = 'none';
        }
    });

    newProjectForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const projectName = document.getElementById('project-name').value;
        await createNewProject(projectName);
        newProjectModal.style.display = 'none';
    });
});

function toggleEditMode() {
    const isEditing = document.getElementById('edit-button').classList.contains('active');
    const projectCards = document.querySelectorAll('.project-card');
    const undoContainer = document.getElementById('undo-container');

    projectCards.forEach(card => {
        if (isEditing) {
            card.classList.add('edit-mode');
        } else {
            card.classList.remove('edit-mode');
        }
    });

    // Toggle the visibility of the undo container based on edit mode
    undoContainer.style.display = isEditing ? 'flex' : 'none';

    //console.log(`Edit mode is ${isEditing ? 'enabled' : 'disabled'}`);
}

async function removeLastToken(userId) {
    const lastToken = await fetchLastTokenForUser(userId);

    if (!lastToken) {
        console.log('No tokens to remove for this user.');
        return;
    }

    const tokenId = lastToken.Id;
    const tokenType = lastToken.TokenType; // Assuming TokenType is part of the token data

    //console.log(`Attempting to delete token with ID: ${tokenId} and TokenType: ${tokenType}`);

    // Delete the most recent token
    await deleteToken(tokenId);

    // Update points based on token type
    let pointsToRemove = 1; // Default points to remove for a Late token
    if (tokenType === 'Ontime') {
        pointsToRemove = 2; // Assume 2 points for Ontime tokens
    }

    userDetails.Points -= pointsToRemove;
    await updateUserPoints(userDetails.Id, userDetails.Points);

    // Update the UI
    await updateProjects(displayDate, userDetails);
    await updateTokenOverview(displayDate, userDetails);
    await updatePointsDisplay(userDetails.Points);
}

async function deleteToken(tokenId) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mg506jpu9lldx26/records`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify({ Id: tokenId }) // Include the Id in the request body if needed
    });

    if (!response.ok) {
        throw new Error(`Failed to delete token with ID ${tokenId}`);
    }

    //console.log(`Token with ID ${tokenId} deleted successfully.`);
}

async function fetchLastTokenForUser(userId) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mg506jpu9lldx26/records?where=(nc_da8u___Users_id,eq,${userId})&sort=-CreatedAt&limit=1`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch tokens');
    }

    const data = await response.json();
    //console.log('Fetched Tokens:', data.list); // Log fetched tokens
    return data.list[0]; // Return only the last token
}

async function updateUserPoints(userId, newPoints) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
    const patchData = {
        Id: userId,
        Points: newPoints
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(patchData)
    });

    if (!response.ok) {
        throw new Error('Failed to update user points');
    }

    return await response.json();
}

async function fetchWorkspaceId() {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/m6kgozqpv7zgpjq/records`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch workspace data');
    }

    const data = await response.json();
    return data.list[0].Id; // Assuming there is only one workspace
}

function generateProjectID(name) {
    // Generate a simple ProjectID based on the project name, truncated and sanitized
    return name.replace(/\s+/g, '').substring(0, 6).toUpperCase();
}
//Duplicate createNewProject function Figure out which one is the right one!
async function createNewProject(projectName) {
    const workspaceId = await fetchWorkspaceId();
    const projectId = generateProjectID(projectName);

    const projectData = {
        Name: projectName,
        ProjectID: projectId,
        Archived: false,
        nc_da8u___Workspace_id: workspaceId
    };

    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mioix65cygxjway/records`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(projectData)
    });

    if (!response.ok) {
        throw new Error('Failed to create new project');
    }

    const newProject = await response.json();
    //console.log('New project created:', newProject);

    // Link the new project with the current user
    await linkUserToProject(userDetails.Id, newProject.Id);
}

async function createNewProject(projectName) {
    const workspaceId = await fetchWorkspaceId();
    const projectId = generateProjectID(projectName);

    const projectData = {
        Name: projectName,
        ProjectID: projectId,
        Archived: false,
        nc_da8u___Workspace_id: workspaceId
    };

    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mioix65cygxjway/records`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(projectData)
    });

    if (!response.ok) {
        throw new Error('Failed to create new project');
    }

    const newProject = await response.json();
    //console.log('New project created:', newProject);

    // Link the new project with the current user
    await linkUserToProject(userDetails.Id, newProject.Id);

    // Re-fetch the updated user details
    userDetails = await refetchUserDetails(userDetails.Id);

    // Update the projects display
    await updateProjects(displayDate, userDetails);
}

async function linkUserToProject(userId, projectId) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mioix65cygxjway/links/c9d1etbtwagiemf/records/${projectId}`;

    const linkData = {
        Id: userId     // The current user's ID
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(linkData)
    });

    if (!response.ok) {
        throw new Error('Failed to link user to project');
    }

    //console.log('User linked to project:', await response.json());
}

async function refetchUserDetails(userId) {
    // Replace with the actual API call to fetch user details
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records/${userId}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user details');
    }

    return await response.json();
}

async function checkHeartsPenalty() {
    const penaltyCheckDate = userDetails.penaltycheckdate ? new Date(userDetails.penaltycheckdate) : null;
    const currentDate = new Date();
    const previousDate = new Date(currentDate);
    previousDate.setDate(currentDate.getDate() - 1);

    let startDate;
    if (penaltyCheckDate) {
        startDate = penaltyCheckDate;
    } else {
        startDate = previousDate;
        await updatePenaltyCheckDate(userDetails.Id, currentDate); // Initialize penalty check date to current date
    }

    const workweek = userDetails.workweek || 'monday,tuesday,wednesday,thursday,friday'; // Default workweek as string
    const dayMap = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
    };
    const workweekArray = workweek.toLowerCase().split(',').map(day => dayMap[day.trim()]);

    // Fetch token counts for each date from startDate to previousDate
    let totalTokens = 0;
    let trackedTokens = 0;

    for (let date = new Date(startDate); date <= previousDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay();
        if (!workweekArray.includes(dayOfWeek)) {
            continue; // Skip non-working days
        }

        const daysAgo = Math.floor((currentDate - date) / (1000 * 60 * 60 * 24));
        const tokenCounts = await fetchDetailedTokenCountsByDate(userDetails.UserID, daysAgo);
        totalTokens += TOKENS_PER_DAY;
        trackedTokens += (tokenCounts.Ontime || 0) + (tokenCounts.Late || 0);
    }

    const trackedPercentage = (trackedTokens / totalTokens) * 100;

    if (trackedPercentage < 75) {
        if (userDetails.Hearts === 1) {
            userDetails.Skull = (userDetails.Skull || 0) + 1;
            userDetails.Hearts = 5;
            await updateUserSkullsAndHearts(userDetails.Id, userDetails.Skull, userDetails.Hearts);
            updateHeartsDisplay(userDetails.Hearts);
            showNotification('Your last heart is gone 💀! Your hearts have been refilled.');
        } else {
            userDetails.Hearts = Math.max(userDetails.Hearts - 1, 0);
            await updateUserHearts(userDetails.Id, userDetails.Hearts);
            updateHeartsDisplay(userDetails.Hearts);
            showNotification('Oh no! You lost a heart ❤️');
        }
    }

    // Update penalty check date to current date
    await updatePenaltyCheckDate(userDetails.Id, currentDate);
}

async function updateUserHearts(userId, newHearts) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
    const patchData = {
        Id: userId,
        Hearts: newHearts
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(patchData)
    });

    if (!response.ok) {
        throw new Error('Failed to update user hearts');
    }

    return await response.json();
}

async function updatePenaltyCheckDate(userId, newDate) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
    const patchData = {
        Id: userId,
        penaltycheckdate: newDate.toISOString().split('T')[0]
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(patchData)
    });

    if (!response.ok) {
        throw new Error('Failed to update penalty check date');
    }

    return await response.json();
}

function updateHeartsDisplay(newHearts) {
    const heartsContainer = document.querySelector('.hearts-container');
    heartsContainer.innerHTML = ''; // Clear existing hearts

    const totalHearts = 5;
    for (let i = 0; i < totalHearts; i++) {
        const heart = document.createElement('span');
        heart.textContent = i < newHearts ? '❤️' : '🖤';
        heart.classList.add('heart');
        heartsContainer.appendChild(heart);
    }
}

async function updateUserSkullsAndHearts(userId, newSkulls, newHearts) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
    const patchData = {
        Id: userId,
        Skull: newSkulls,
        Hearts: newHearts
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(patchData)
    });

    if (!response.ok) {
        throw new Error('Failed to update user skulls and hearts');
    }

    return await response.json();
}

async function checkAndUpdateBadges() {
    const currentPoints = userDetails.Points;
    const earnedBadges = BADGE_LEVELS.filter(level => currentPoints >= level);
    const previousBadges = userDetails.Badges || [];
    const notifiedBadges = userDetails.notifiedBadges ? userDetails.notifiedBadges.split(',').map(Number) : [];

    userDetails.Badges = earnedBadges; // Store earned badges in userDetails
    const newNotifiedBadges = [...new Set([...notifiedBadges, ...earnedBadges.filter(badge => !notifiedBadges.includes(badge))])];
    userDetails.notifiedBadges = newNotifiedBadges.join(',');
    await updateUserNotifiedBadges(userDetails.Id, userDetails.notifiedBadges);
    updateBadgesDisplay(earnedBadges);

    // Find new badges earned since last check
    const newBadges = earnedBadges.filter(badge => !notifiedBadges.includes(badge));
    newBadges.forEach(badge => {
        const badgeIndex = BADGE_LEVELS.indexOf(badge);
        if (badgeIndex !== -1) {
            showNotification(`Congrats! You earned a ${BADGE_LEVELS[badgeIndex]} pts badge ${BADGE_EMOJIS[badgeIndex]}`);
        }
    });
}

async function updateUserNotifiedBadges(userId, notifiedBadges) {
    const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
    const patchData = {
        Id: userId,
        notifiedBadges: notifiedBadges // Store as comma-separated string
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'xc-token': token
        },
        body: JSON.stringify(patchData)
    });

    if (!response.ok) {
        throw new Error('Failed to update user notified badges');
    }

    return await response.json();
}

function updateBadgesDisplay(badges) {
    const badgesContainer = document.getElementById('badges-container');
    const highestBadgeElement = document.getElementById('highest-badge');

    if (badgesContainer && highestBadgeElement) {
        badgesContainer.innerHTML = ''; // Clear existing badges
        let highestBadge = 0;

        badges.forEach(badge => {
            const badgeIndex = BADGE_LEVELS.indexOf(badge);
            if (badgeIndex !== -1) {
                const badgeElement = document.createElement('span');
                badgeElement.classList.add('badge');
                badgeElement.textContent = BADGE_EMOJIS[badgeIndex];
                badgesContainer.appendChild(badgeElement);
                highestBadge = badge;
            }
        });

        highestBadgeElement.textContent = highestBadge !== 0 
            ? `Highest Badge: ${highestBadge} pts earned`
            : 'No badges earned yet';
    } else {
        console.error('Badges container or highest badge element not found.');
    }
}

function initializeModal() {
    const userImage = document.querySelector('.user-card img');
    const modal = document.getElementById('stats-modal');
    const closeButton = document.querySelector('.close-buton');
    const totalPointsElement = document.getElementById('total-points');
    const totalSkullsElement = document.getElementById('total-skulls');

        userImage.addEventListener('click', () => {
            totalPointsElement.textContent = `⭐ x${userDetails.Points || 0}`;
            totalSkullsElement.textContent = `💀 x${userDetails.Skull || 0}`;
            updateBadgesDisplay(userDetails.Badges || []);
            modal.style.display = 'block';
        });

        closeButton.addEventListener('click', () => {
            console.log('Close button clicked');
            modal.style.display = 'none';
        });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showNotification(message) {
    notificationQueue.push(message);
    if (!isNotificationActive) {
        displayNextNotification();
    }
}

function displayNextNotification() {
    if (notificationQueue.length === 0) {
        isNotificationActive = false;
        return;
    }

    isNotificationActive = true;
    const notification = document.getElementById('notification');
    notification.textContent = notificationQueue.shift();
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(displayNextNotification, 500); // Wait for the fadeout animation to complete
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    const menuIcon = document.getElementById('menu-icon');
    const mainMenuModal = document.getElementById('main-menu-modal');
    const closeMainMenu = document.querySelector('.close-main-menu');
    const logoutButton = document.getElementById('logout-button');

    menuIcon.addEventListener('click', () => {
        mainMenuModal.style.display = 'block';
    });

    closeMainMenu.addEventListener('click', () => {
        mainMenuModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === mainMenuModal) {
            mainMenuModal.style.display = 'none';
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loginData'); // Remove login data from local storage
        location.reload(); // Reload the page to show the login screen
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const mainQuestsButton = document.getElementById('main-quests-button');
    const sideQuestsButton = document.getElementById('side-quests-button');
    const projectsContainer = document.getElementById('projects-container');
    const ptoContainer = document.getElementById('pto-container');
    const ptoLeftDisplay = document.getElementById('pto-left-display');
    const ptoTokensLeft = document.getElementById('pto-tokens-left'); // New element for displaying the number of tokens
    const ptoOneHourButton = document.querySelector('.pto-one-hour');

    // Update PTO card labels
    document.querySelector('.pto-card:nth-child(3) h3').textContent = `PTO ${HOURS_PER_TOKEN} hr`;

    // Initially set the Main Quests button as active
    mainQuestsButton.classList.add('active');
    projectsContainer.style.display = 'block'; // Ensure projects are displayed initially
    ptoContainer.style.display = 'none';

    mainQuestsButton.addEventListener('click', () => {
        projectsContainer.style.display = 'block'; // Changed to 'block'
        ptoContainer.style.display = 'none';
        mainQuestsButton.classList.add('active');
        sideQuestsButton.classList.remove('active');
    });

    sideQuestsButton.addEventListener('click', () => {
        projectsContainer.style.display = 'none';
        ptoContainer.style.display = 'block'; // Changed to 'block'
        updatePTOLeftDisplay();
        sideQuestsButton.classList.add('active');
        mainQuestsButton.classList.remove('active');
    });

    async function handlePTOClick(hours) {
        const ptoLeft = userDetails.PTOleft;
        const currentTokenCounts = await fetchDetailedTokenCountsByDate(userDetails.UserID, getDaysAgo(displayDate));
        const currentTokensUsed = currentTokenCounts.Ontime + currentTokenCounts.Late + currentTokenCounts.Pto;
        const remainingTokens = TOKENS_PER_DAY - currentTokensUsed;
        let tokensToAdd = 0;

        if (remainingTokens <= 0) {
            alert('All tokens are spent for this date.');
            return;
        }

        if (hours === 'full') {
            tokensToAdd = Math.min(ptoLeft, remainingTokens);
        } else {
            tokensToAdd = Math.min(ptoLeft, HOURS_PER_TOKEN, remainingTokens);
        }

        if (tokensToAdd > 0) {
            const tokenCount = hours === 'full' ? tokensToAdd : 1;
            const totalTokensAdded = tokenCount;

            for (let i = 0; i < tokenCount; i++) {
                const tokenData = {
                    Duration: HOURS_PER_TOKEN,
                    start: displayDate.toISOString().slice(0, 10) + ' 00:00', // Assuming start time is 00:00
                    nc_da8u___Users_id: userDetails.Id,
                    TokenType: 'Pto',
                    nc_da8u___Projects_id: null // No specific project ID for PTO
                };

                await sendTokenData(tokenData);
            }

            userDetails.PTOleft -= tokensToAdd;
            await updateUserPTOleft(userDetails.Id, userDetails.PTOleft);

            // Update user points (2 points per PTO token used)
            userDetails.Points += totalTokensAdded * 2;
            await updateUserPoints(userDetails.Id, userDetails.Points);

            updatePointsDisplay(userDetails.Points);
            await updateTokenOverview(displayDate, userDetails);
            updatePTOLeftDisplay();
        } else {
            alert('No more PTO tokens available.');
        }
    }

    async function updatePTOLeftDisplay() {
        ptoLeftDisplay.textContent = `PTO left: ${userDetails.PTOleft}hrs`;
        const tokensLeft = Math.floor(userDetails.PTOleft / HOURS_PER_TOKEN);
        ptoTokensLeft.textContent = `Tokens left: ${tokensLeft} 🟢`;
    }

    async function updateUserPTOleft(userId, newPTOleft) {
        const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
        const patchData = {
            Id: userId,
            PTOleft: newPTOleft
        };

        // Log the payload to debug
        console.log('Patch Data:', patchData);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'xc-token': token
            },
            body: JSON.stringify(patchData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to update user PTOleft:', errorData);
            throw new Error('Failed to update user PTOleft');
        }

        return await response.json();
    }

    async function updateUserPoints(userId, newPoints) {
        const url = `https://nocodb-production-fc9f.up.railway.app/api/v2/tables/mgb2oyswnowx1zd/records`;
        const patchData = {
            Id: userId,
            Points: newPoints
        };

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'xc-token': token
            },
            body: JSON.stringify(patchData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to update user points:', errorData);
            throw new Error('Failed to update user points');
        }

        return await response.json();
    }

    function getDaysAgo(date) {
        const currentDate = new Date();
        return Math.floor((currentDate - date) / (1000 * 60 * 60 * 24));
    }

    // Expose handlePTOClick and updatePTOLeftDisplay to the global scope
    window.handlePTOClick = handlePTOClick;
    window.updatePTOLeftDisplay = updatePTOLeftDisplay;
});
