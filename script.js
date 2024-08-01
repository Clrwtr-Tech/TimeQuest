const HOURS_IN_WORKDAY = 8;
const TOKENS_PER_DAY = 16;
const HOURS_PER_TOKEN = HOURS_IN_WORKDAY / TOKENS_PER_DAY;

let displayDate = new Date();
let userDetails;

let username;

// Define functions globally or at the top level
function updateDateDisplay() {
    const dateDisplay = document.getElementById('date-display');
    if (!dateDisplay) {
        console.error('Date display element not found.');
        return;
    }

    const options = { month: 'short', day: 'numeric' };
    dateDisplay.textContent = displayDate.toLocaleDateString('en-US', options);
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
            displayUserData(userDetails, userContainer);
            
            // Set initial date display
            updateDateDisplay();

            // Fetch and update projects and token overview initially
            await updateProjects(displayDate, userDetails);
            await updateTokenOverview(displayDate, userDetails);
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

    // Log tokenData to ensure it's correctly structured
    //console.log('Token Data:', tokenData);

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
    //console.log('Token counts:', tokenCounts); // Log the token counts for debugging
    
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
