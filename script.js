const API_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjZDBmMDNjMmQ4OGE5MzE4MWNkYzE0MjcyMTg0MWQ2YSIsIm5iZiI6MTc5MTE1MzQ4My4yNTcsInN1YiI6IjZhYzJkNTRiZmVlMmRhMTJjN2ZmNDFmZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.UOeeMPNpaC_67KtueawWusfob5lgVSYii_F_9fCB9dM";

const API_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json"
};

const genres = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western"
};

let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let watchLater = JSON.parse(localStorage.getItem("watchLater")) || [];
let recentlyViewed = JSON.parse(localStorage.getItem("recentlyViewed")) || [];

let currentMovies = [];
let currentFilter = "all";
let currentGenre = "all";
let currentRating = 0;

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const movieContainer = document.getElementById("movieContainer");
const trendingContainer = document.getElementById("trendingContainer");
const recommendationContainer = document.getElementById("recommendationContainer");
const recentContainer = document.getElementById("recentContainer");
const message = document.getElementById("message");
const movieCount = document.getElementById("movieCount");

const movieModal = document.getElementById("movieModal");
const closeModal = document.getElementById("closeModal");
const movieDetails = document.getElementById("movieDetails");

const genreFilter = document.getElementById("genreFilter");
const ratingFilter = document.getElementById("ratingFilter");
const surpriseButton = document.getElementById("surpriseButton");
const clearSearchButton = document.getElementById("clearSearchButton");
const scrollTopButton = document.getElementById("scrollTopButton");

clearSearchButton.addEventListener("click", function() {
    searchInput.value = "";
    currentMovies = [];
    movieContainer.innerHTML = "";
    movieCount.textContent = "0 movies";
    message.textContent = "Search for a movie to get started.";
    searchInput.focus();
});

document.addEventListener("keydown", function(event) {
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        searchInput.focus();
    }

    if (event.key === "Escape") {
        movieModal.classList.remove("show");
    }
});

window.addEventListener("scroll", function() {
    scrollTopButton.classList.toggle("visible", window.scrollY > 500);
});

scrollTopButton.addEventListener("click", function() {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

searchButton.addEventListener("click", searchMovies);

searchInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        searchMovies();
    }
});

async function searchMovies() {

    const query = searchInput.value.trim();

    if (!query) {
        message.textContent = "⚠️ Please enter a movie title.";
        movieContainer.innerHTML = "";
        movieCount.textContent = "0 movies";
        return;
    }

    message.textContent = "Searching for movies...";
    movieContainer.innerHTML = "";

    try {

        const response = await fetch(
            `${API_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
            {
                headers: headers
            }
        );

        if (!response.ok) {
            throw new Error("API request failed.");
        }

        const data = await response.json();

        currentMovies = data.results || [];

        currentFilter = "all";
        currentGenre = "all";
        currentRating = 0;

        resetFilters();

        if (currentMovies.length === 0) {
            message.textContent = "😢 No movies found. Try another title.";
            movieCount.textContent = "0 movies";
            return;
        }

        message.textContent = "";
        displayMovies();

        document.getElementById("movies").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error(error);

        message.textContent =
            "❌ Something went wrong. Please check your API key or internet connection.";
    }
}

function displayMovies() {

    let moviesToDisplay = [...currentMovies];

    if (currentFilter === "favorites") {
        moviesToDisplay = favorites;
    }

    if (currentFilter === "watchLater") {
        moviesToDisplay = watchLater;
    }

    if (currentGenre !== "all") {
        moviesToDisplay = moviesToDisplay.filter(movie =>
            movie.genre_ids &&
            movie.genre_ids.includes(Number(currentGenre))
        );
    }

    if (currentRating > 0) {
        moviesToDisplay = moviesToDisplay.filter(movie =>
            movie.vote_average >= currentRating
        );
    }

    movieContainer.innerHTML = "";

    movieCount.textContent =
        `${moviesToDisplay.length} movie${moviesToDisplay.length !== 1 ? "s" : ""}`;

    if (moviesToDisplay.length === 0) {

        movieContainer.innerHTML = `
            <p class="message">
                No movies match your selected filters.
            </p>
        `;

        return;
    }

    moviesToDisplay.forEach(movie => {
        movieContainer.appendChild(createMovieCard(movie));
    });
}

function createMovieCard(movie) {

    const card = document.createElement("div");
    card.className = "movie-card";

    const poster = movie.poster_path
        ? `${IMAGE_URL}${movie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Poster";

    const year = movie.release_date
        ? movie.release_date.substring(0, 4)
        : "N/A";

    const movieGenres = movie.genre_ids
        ? movie.genre_ids
            .map(id => genres[id])
            .filter(Boolean)
            .slice(0, 2)
        : [];

    const isFavorite = favorites.some(item => item.id === movie.id);
    const isWatchLater = watchLater.some(item => item.id === movie.id);

    card.innerHTML = `
        <div class="poster-container">

            <img
                src="${poster}"
                alt="${movie.title}"
            >

            <div class="rating">
                ⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
            </div>

        </div>

        <div class="movie-info">

            <h3>${movie.title}</h3>

            <p class="year">${year}</p>

            <div class="genre-list">
                ${movieGenres.map(genre =>
                    `<span>${genre}</span>`
                ).join("")}
            </div>

            <div class="card-actions">

                <button
                    class="action-btn favorite-btn ${isFavorite ? "selected" : ""}"
                    data-id="${movie.id}"
                    title="Favorite"
                >
                    ${isFavorite ? "❤️" : "🤍"}
                </button>

                <button
                    class="action-btn watch-btn ${isWatchLater ? "selected" : ""}"
                    data-id="${movie.id}"
                    title="Watch Later"
                >
                    ${isWatchLater ? "🔖" : "🏷️"}
                </button>

                <button
                    class="details-btn"
                    data-id="${movie.id}"
                >
                    Details
                </button>

            </div>

        </div>
    `;

    card.querySelector(".favorite-btn").addEventListener("click", function(event) {
        event.stopPropagation();
        toggleFavorite(movie);
    });

    card.querySelector(".watch-btn").addEventListener("click", function(event) {
        event.stopPropagation();
        toggleWatchLater(movie);
    });

    card.querySelector(".details-btn").addEventListener("click", function(event) {
        event.stopPropagation();
        showMovieDetails(movie);
    });

    card.querySelector(".poster-container").addEventListener("click", function() {
        showMovieDetails(movie);
    });

    return card;
}

function toggleFavorite(movie) {

    const index = favorites.findIndex(item => item.id === movie.id);

    if (index === -1) {
        favorites.push(movie);
    } else {
        favorites.splice(index, 1);
    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    displayMovies();
    displayRecent();
}

function toggleWatchLater(movie) {

    const index = watchLater.findIndex(item => item.id === movie.id);

    if (index === -1) {
        watchLater.push(movie);
    } else {
        watchLater.splice(index, 1);
    }

    localStorage.setItem(
        "watchLater",
        JSON.stringify(watchLater)
    );

    displayMovies();
}

function addToRecentlyViewed(movie) {

    recentlyViewed = recentlyViewed.filter(
        item => item.id !== movie.id
    );

    recentlyViewed.unshift(movie);

    recentlyViewed = recentlyViewed.slice(0, 6);

    localStorage.setItem(
        "recentlyViewed",
        JSON.stringify(recentlyViewed)
    );

    displayRecent();
}

function displayRecent() {

    recentContainer.innerHTML = "";

    if (recentlyViewed.length === 0) {

        recentContainer.innerHTML = `
            <p class="message">
                Movies you view will appear here.
            </p>
        `;

        return;
    }

    recentlyViewed.forEach(movie => {
        recentContainer.appendChild(
            createMovieCard(movie)
        );
    });
}

async function showMovieDetails(movie) {

    addToRecentlyViewed(movie);

    movieModal.classList.add("show");

    movieDetails.innerHTML = `
        <p class="loading">Loading movie details...</p>
    `;

    try {

        const response = await fetch(
            `${API_URL}/movie/${movie.id}?append_to_response=videos`,
            {
                headers: headers
            }
        );

        const details = await response.json();

        const poster = details.poster_path
            ? `${IMAGE_URL}${details.poster_path}`
            : "https://via.placeholder.com/500x750?text=No+Poster";

        const isFavorite = favorites.some(
            item => item.id === movie.id
        );

        const isWatchLater = watchLater.some(
            item => item.id === movie.id
        );

        const genresText = details.genres
            ? details.genres.map(genre => genre.name).join(", ")
            : "Unknown";

        const trailer = details.videos?.results?.find(
            video =>
                video.type === "Trailer" &&
                video.site === "YouTube"
        );

        movieDetails.innerHTML = `
            <div class="details-layout">

                <img
                    class="details-poster"
                    src="${poster}"
                    alt="${details.title}"
                >

                <div class="details-info">

                    <p class="section-label">MOVIE DETAILS</p>

                    <h2>${details.title}</h2>

                    <div class="details-meta">
                        <span>📅 ${details.release_date || "N/A"}</span>
                        <span>⭐ ${details.vote_average?.toFixed(1) || "N/A"}</span>
                    </div>

                    <p>
                        <strong>🎭 Genre:</strong>
                        ${genresText}
                    </p>

                    <p class="overview">
                        ${details.overview || "No description available."}
                    </p>

                    <div class="modal-actions">

                        <button
                            id="modalFavorite"
                            class="modal-action"
                        >
                            ${isFavorite ? "❤️ Remove Favorite" : "🤍 Add Favorite"}
                        </button>

                        <button
                            id="modalWatchLater"
                            class="modal-action"
                        >
                            ${isWatchLater ? "🔖 Remove Watch Later" : "🏷️ Watch Later"}
                        </button>

                        ${
                            trailer
                            ? `
                            <a
                                class="trailer-btn"
                                href="https://www.youtube.com/watch?v=${trailer.key}"
                                target="_blank"
                            >
                                ▶️ Watch Trailer
                            </a>
                            `
                            : ""
                        }

                    </div>

                </div>

            </div>
        `;

        document.getElementById("modalFavorite")
            .addEventListener("click", function() {
                toggleFavorite(details);
                showMovieDetails(details);
            });

        document.getElementById("modalWatchLater")
            .addEventListener("click", function() {
                toggleWatchLater(details);
                showMovieDetails(details);
            });

        loadRecommendations(movie.id);

    } catch (error) {

        console.error(error);

        movieDetails.innerHTML = `
            <p class="message">
                Unable to load movie details.
            </p>
        `;
    }
}

async function loadRecommendations(movieId) {

    try {

        const response = await fetch(
            `${API_URL}/movie/${movieId}/recommendations?language=en-US&page=1`,
            {
                headers: headers
            }
        );

        const data = await response.json();

        recommendationContainer.innerHTML = "";

        const recommendations = data.results.slice(0, 6);

        if (recommendations.length === 0) {

            recommendationContainer.innerHTML = `
                <p class="message">
                    No recommendations available.
                </p>
            `;

            return;
        }

        recommendations.forEach(movie => {
            recommendationContainer.appendChild(
                createMovieCard(movie)
            );
        });

    } catch (error) {

        console.error(error);
    }
}

async function loadTrending() {

    try {

        const response = await fetch(
            `${API_URL}/trending/movie/week`,
            {
                headers: headers
            }
        );

        const data = await response.json();

        trendingContainer.innerHTML = "";

        data.results.slice(0, 6).forEach(movie => {

            trendingContainer.appendChild(
                createMovieCard(movie)
            );

        });

    } catch (error) {

        console.error(error);

        trendingContainer.innerHTML = `
            <p class="message">
                Unable to load trending movies.
            </p>
        `;
    }
}

async function surpriseMe() {

    try {

        surpriseButton.textContent = "🎲 Finding...";

        const response = await fetch(
            `${API_URL}/trending/movie/week`,
            {
                headers: headers
            }
        );

        const data = await response.json();

        const movies = data.results;

        if (movies.length === 0) {
            return;
        }

        const randomMovie =
            movies[Math.floor(Math.random() * movies.length)];

        showMovieDetails(randomMovie);

    } catch (error) {

        console.error(error);

    } finally {

        surpriseButton.textContent = "🎲 Surprise Me";
    }
}

surpriseButton.addEventListener("click", surpriseMe);

function loadGenreFilter() {

    Object.entries(genres).forEach(([id, name]) => {

        const option = document.createElement("option");

        option.value = id;
        option.textContent = name;

        genreFilter.appendChild(option);
    });
}

genreFilter.addEventListener("change", function() {

    currentGenre = this.value;

    displayMovies();
});

ratingFilter.addEventListener("change", function() {

    currentRating = Number(this.value);

    displayMovies();
});

document.querySelectorAll(".filter-btn").forEach(button => {

    button.addEventListener("click", function() {

        document.querySelectorAll(".filter-btn")
            .forEach(btn => btn.classList.remove("active"));

        this.classList.add("active");

        currentFilter = this.dataset.filter;

        displayMovies();
    });

});

function resetFilters() {

    document.querySelectorAll(".filter-btn")
        .forEach(btn => btn.classList.remove("active"));

    document.querySelector('[data-filter="all"]')
        .classList.add("active");

    genreFilter.value = "all";
    ratingFilter.value = "0";
}

closeModal.addEventListener("click", function() {
    movieModal.classList.remove("show");
});

movieModal.addEventListener("click", function(event) {

    if (event.target === movieModal) {
        movieModal.classList.remove("show");
    }

});

loadGenreFilter();
loadTrending();
displayRecent();
