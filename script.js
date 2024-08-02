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
    if (workweekArray.includes(dayOfWeek)) {
        dateContainer.classList.remove('non-working-day', 'today');
        dateContainer.classList.add('working-day');
    } else {
        dateContainer.classList.remove('working-day', 'today');
        dateContainer.classList.add('non-working-day');
    }

    // Check if the displayed date is today
    if (isToday(displayDate)) {
        dateContainer.classList.add('today');
    } else {
        dateContainer.classList.remove('today');
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
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    //const appContainer = document.getElementById('app-container');
    const prevArrow = document.getElementById('prev-arrow');
    const nextArrow = document.getElementById('next-arrow');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const enteredUsername = document.getElementById('username').value;
        const enteredPassword = document.getElementById('password').value;

        // Authenticate user
        const isAuthenticated = await authenticateUser(enteredUsername, enteredPassword);

        if (isAuthenticated) {
            username = enteredUsername; // Commit the username
            loginContainer.style.display = 'none';

            // Initialize the app after successful login
            await initializeApp();
        } else {
            alert('Invalid username or password');
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

    return user && user.Password === password;
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

    projects.forEach(project => {
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

async function handleProjectClick(projectId) {
    const tokenType = isToday(displayDate) ? 'Ontime' : 'Late';
    const timezoneOffset = displayDate.getTimezoneOffset() * 60000; // Offset in milliseconds
    const localDate = new Date(displayDate.getTime() - timezoneOffset);
    const startDateTime = localDate.toISOString().slice(0, 16).replace('T', ' ');

    const tokenData = {
        Duration: HOURS_PER_TOKEN,
        start: startDateTime,
        nc_da8u___Users_id: userDetails.Id,
        TokenType: tokenType,
        nc_da8u___Projects_id: projectId.Id
    };

    await sendTokenData(tokenData);

    // Determine points based on token type
    const points = tokenType === 'Ontime' ? 2 : 1; // Adjust multiplier as needed

    // Update user points
    userDetails.Points += points;
    await updateUserPoints(userDetails.Id, userDetails.Points);

    // Update UI to reflect new points
    updatePointsDisplay(userDetails.Points);

    await updateProjects(displayDate, userDetails);
    await updateTokenOverview(displayDate, userDetails);
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

    const currentDate = new Date();
    const daysAgo = Math.floor((currentDate - displayDate) / (1000 * 60 * 60 * 24));

    const tokenCounts = await fetchDetailedTokenCountsByDate(userDetails.UserID, daysAgo);
    const ontimeCount = tokenCounts.Ontime || 0;
    const lateCount = tokenCounts.Late || 0;
    const totalUsedTokens = ontimeCount + lateCount;
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
        } else {
            tokenElement.textContent = '⚪';
        }
    }

    // Update total hours text
    totalHoursText.textContent = `Total hours tracked: ${totalHoursTracked.toFixed(1)} hours`;
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