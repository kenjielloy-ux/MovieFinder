const API_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjZDBmMDNjMmQ4OGE5MzE4MWNkYzE0MjcyMTg0MWQ2YSIsIm5iZiI6MTc5MTE1MzQ4My4yNTcsInN1YiI6IjZhYzJkNTRiZmVlMmRhMTJjN2ZmNDFmZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.UOeeMPNpaC_67KtueawWusfob5lgVSYii_F_9fCB9dM";
const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/";
const $ = id => document.getElementById(id);

const state = {
    page: "home",
    previousPages: [],
    featuredMovies: [],
    featuredMovie: null,
    currentMovies: [],
    favorites: loadSaved("mf_favorites"),
    watchLater: loadSaved("mf_watch_later"),
    history: loadSaved("mf_history"),
    recommendations: [],
    filter: "all",
    collectionTab: "favorites",
    lastMovieId: null,
    genreMap: {},
    movieCache: new Map()
};

function loadSaved(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
}

function saveSaved(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function posterURL(path, size = "w500") {
    return path ? `${IMAGE_BASE}${size}${path}` : "";
}

function backdropURL(path, size = "original") {
    return path ? `${IMAGE_BASE}${size}${path}` : "";
}

function movieTitle(movie) {
    return movie.title || movie.name || "Untitled";
}

function movieDate(movie) {
    return movie.release_date || movie.first_air_date || "";
}

function yearOf(date) {
    return date ? date.slice(0, 4) : "Year unavailable";
}

function ratingOf(value) {
    return Number(value || 0).toFixed(1);
}

function uniqueById(items) {
    return [...new Map(
        (items || [])
            .filter(item => item && item.id)
            .map(item => [Number(item.id), item])
    ).values()];
}

async function api(path, params = {}) {
    const url = new URL(`${API_BASE}${path}`);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(
            response.status === 401
                ? "TMDB rejected the API token. Check the token in script.js."
                : `TMDB request failed (${response.status}). Please try again.`
        );
    }

    return response.json();
}

function showMessage(id, message) {
    const element = $(id);
    if (element) element.textContent = message;
}

/* Load previously saved movies */

function loadSavedMovies() {
    const oldFavorites = loadSaved("favorites");
    const oldWatchLater = loadSaved("watchLater");
    const oldHistory = loadSaved("recentlyViewed");

    if (!state.favorites.length && oldFavorites.length) {
        state.favorites = oldFavorites.map(item =>
            typeof item === "object" ? Number(item.id) : Number(item)
        ).filter(Boolean);

        saveSaved("mf_favorites", state.favorites);
    }

    if (!state.watchLater.length && oldWatchLater.length) {
        state.watchLater = oldWatchLater.map(item =>
            typeof item === "object" ? Number(item.id) : Number(item)
        ).filter(Boolean);

        saveSaved("mf_watch_later", state.watchLater);
    }

    if (!state.history.length && oldHistory.length) {
        state.history = oldHistory;
        saveSaved("mf_history", state.history);
    }

    [...oldFavorites, ...oldWatchLater, ...state.history].forEach(item => {
        if (item && typeof item === "object" && item.id) {
            state.movieCache.set(Number(item.id), item);
        }
    });
}

loadSavedMovies();

/* Navigation */

function showPage(page, remember = true) {
    if (!$(page)) return;

    if (remember && state.page !== page) {
        state.previousPages.push(state.page);
    }

    state.page = page;

    document.querySelectorAll(".page").forEach(section => {
        section.classList.toggle("active", section.id === page);
    });

    document.querySelectorAll("[data-page]").forEach(link => {
        link.classList.toggle("active", link.dataset.page === page);
    });

    window.scrollTo({ top: 0, behavior: "auto" });

    if (page === "collection") renderCollection();
    if (page === "history") renderHistory();
    if (page === "explore") renderMovies(state.currentMovies);
}

function goBack() {
    if ($("movieModal").classList.contains("show")) {
        closeModal();
        return;
    }

    const previous = state.previousPages.pop();
    showPage(previous || "home", false);
}

document.querySelectorAll("[data-page]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        showPage(link.dataset.page);
    });
});

document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", goBack);
});

$("openSearch").addEventListener("click", () => {
    showPage("explore");
    $("exploreSearchInput").focus();
});

/* Featured movies */

async function loadFeaturedMovies() {
    try {
        const data = await api("/trending/movie/week", {
            language: "en-US"
        });

        state.featuredMovies = uniqueById(
            (data.results || []).filter(movie =>
                movie.backdrop_path || movie.poster_path
            )
        );

        if (!state.featuredMovies.length) {
            throw new Error("No featured movies were returned.");
        }

        const genreData = await api("/genre/movie/list", {
            language: "en-US"
        });

        state.genreMap = Object.fromEntries(
            (genreData.genres || []).map(genre => [
                genre.id,
                genre.name
            ])
        );

        state.featuredMovies.forEach(movie => {
            state.movieCache.set(Number(movie.id), movie);
        });

        displayFeatured(chooseRandomMovie());

        renderMovies(
            state.featuredMovies.slice(0, 10),
            "trendingContainer"
        );

        state.currentMovies = state.featuredMovies;
        renderMovies(state.currentMovies);

        showMessage("message", "Choose a movie to see its details.");
    } catch (error) {
        console.error(error);
        $("featuredTitle").textContent = "Your next story awaits.";
        $("featuredOverview").textContent = error.message;
        showMessage("message", error.message);
    }
}

function chooseRandomMovie() {
    if (!state.featuredMovies.length) return null;

    const alternatives = state.featuredMovies.filter(movie =>
        Number(movie.id) !== Number(state.featuredMovie?.id)
    );

    const pool = alternatives.length
        ? alternatives
        : state.featuredMovies;

    return pool[Math.floor(Math.random() * pool.length)];
}

function displayFeatured(movie) {
    if (!movie) return;

    state.featuredMovie = movie;
    state.movieCache.set(Number(movie.id), movie);

    const backdrop = backdropURL(movie.backdrop_path) ||
        posterURL(movie.poster_path, "w780");

    $("featuredBackground").style.backgroundImage = backdrop
        ? `url("${backdrop}")`
        : "linear-gradient(135deg, #362241, #100b18)";

    $("featuredTitle").textContent = movieTitle(movie);

    $("featuredOverview").textContent =
        movie.overview || "Open this movie to learn more about its story.";

    $("featuredMeta").replaceChildren();

    const meta = [
        movieDate(movie) ? yearOf(movieDate(movie)) : "",
        movie.vote_average
            ? `Rating ${ratingOf(movie.vote_average)}/10`
            : "",
        movie.original_language
            ? movie.original_language.toUpperCase()
            : ""
    ].filter(Boolean);

    meta.forEach(value => {
        const span = document.createElement("span");
        span.textContent = value;
        $("featuredMeta").appendChild(span);
    });

    const index = state.featuredMovies.findIndex(item =>
        Number(item.id) === Number(movie.id)
    );

    $("featuredCounter").textContent =
        index >= 0 ? `FILM ${index + 1}` : "FEATURED FILM";
}

$("anotherMovie").addEventListener("click", () => {
    displayFeatured(chooseRandomMovie());
});

$("featuredDetails").addEventListener("click", () => {
    if (state.featuredMovie) {
        openMovie(state.featuredMovie.id);
    }
});

$("surpriseButton").addEventListener("click", () => {
    displayFeatured(chooseRandomMovie());
    window.scrollTo({ top: 0, behavior: "smooth" });
});

/* Create movie cards */

function movieCard(movie) {
    const id = Number(movie.id);
    const favorite = state.favorites.includes(id);
    const watchLater = state.watchLater.includes(id);
    const title = movieTitle(movie);
    const poster = posterURL(movie.poster_path);

    state.movieCache.set(id, movie);

    return `
        <article class="movie-card">
            <div class="poster-container"
                data-open-movie="${id}"
                role="button"
                tabindex="0"
                aria-label="View details for ${escapeHTML(title)}">

                ${
                    poster
                        ? `<img src="${poster}"
                            alt="${escapeHTML(title)} poster"
                            loading="lazy"
                            onerror="this.style.display='none'">`
                        : `<div class="poster-placeholder">
                            ${escapeHTML(title)}
                           </div>`
                }

                ${
                    movie.vote_average
                        ? `<span class="rating">
                            ${ratingOf(movie.vote_average)}
                           </span>`
                        : ""
                }
            </div>

            <div class="movie-info">
                <h3>${escapeHTML(title)}</h3>

                <p class="year">
                    ${escapeHTML(yearOf(movieDate(movie)))}
                </p>

                <div class="card-actions">
                    <button class="action-btn ${favorite ? "selected" : ""}"
                        type="button"
                        data-toggle="favorite"
                        data-id="${id}"
                        aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}"
                        title="${favorite ? "Remove from favorites" : "Add to favorites"}">
                        ${favorite ? "♥" : "♡"}
                    </button>

                    <button class="action-btn ${watchLater ? "selected" : ""}"
                        type="button"
                        data-toggle="watchLater"
                        data-id="${id}"
                        aria-label="${watchLater ? "Remove from watch later" : "Add to watch later"}"
                        title="${watchLater ? "Remove from watch later" : "Add to watch later"}">
                        ${watchLater ? "✓" : "+"}
                    </button>

                    <button class="details-btn"
                        type="button"
                        data-open-movie="${id}">
                        Details
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderMovies(movies, containerId = "movieContainer") {
    const container = $(containerId);
    if (!container) return;

    const uniqueMovies = uniqueById(movies || []);

    uniqueMovies.forEach(movie => {
        state.movieCache.set(Number(movie.id), movie);
    });

    if (containerId === "movieContainer") {
        let filtered = uniqueMovies;

        if (state.filter === "favorites") {
            filtered = filtered.filter(movie =>
                state.favorites.includes(Number(movie.id))
            );
        } else if (state.filter === "watchLater") {
            filtered = filtered.filter(movie =>
                state.watchLater.includes(Number(movie.id))
            );
        }

        const genre = $("genreFilter").value;
        const rating = Number($("ratingFilter").value || 0);

        if (genre !== "all") {
            filtered = filtered.filter(movie =>
                (movie.genre_ids || []).includes(Number(genre))
            );
        }

        if (rating > 0) {
            filtered = filtered.filter(movie =>
                Number(movie.vote_average || 0) >= rating
            );
        }

        $("movieCount").textContent =
            `${filtered.length} ${filtered.length === 1 ? "movie" : "movies"}`;

        container.innerHTML = filtered.length
            ? filtered.map(movieCard).join("")
            : `<p class="empty-state">No movies match these filters.</p>`;

        return;
    }

    container.innerHTML = uniqueMovies.length
        ? uniqueMovies.map(movieCard).join("")
        : `<p class="empty-state">No movies to display yet.</p>`;
}

/* Search movies */

async function searchMovies(query, type = "multi") {
    const cleaned = query.trim();

    if (!cleaned) {
        showMessage("message", "Enter a movie or title first.");
        return;
    }

    if (type === "person") {
        showPage("people");
        $("peopleSearchInput").value = cleaned;
        await searchPeople(cleaned);
        return;
    }

    showPage("explore");
    $("exploreSearchInput").value = cleaned;
    $("searchType").value = type;

    showMessage("message", "Searching TMDB...");
    $("movieContainer").innerHTML = "";

    try {
        const endpoint = type === "movie"
            ? "/search/movie"
            : "/search/multi";

        const data = await api(endpoint, {
            query: cleaned,
            include_adult: false,
            language: "en-US",
            page: 1
        });

        const results = (data.results || []).filter(item =>
            item.media_type !== "person" &&
            (item.media_type === "movie" ||
             item.media_type === "tv" ||
             item.title)
        );

        state.currentMovies = results;
        state.filter = "all";

        document.querySelectorAll("[data-filter]").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.filter === "all"
            );
        });

        $("resultsTitle").textContent = `Results for "${cleaned}"`;

        showMessage(
            "message",
            results.length
                ? `Found ${results.length} matching movies.`
                : "No matching movies were found. Try another title."
        );

        renderMovies(results);
    } catch (error) {
        console.error(error);
        showMessage("message", error.message);
    }
}

$("exploreSearchForm").addEventListener("submit", event => {
    event.preventDefault();

    searchMovies(
        $("exploreSearchInput").value,
        $("searchType").value
    );
});

/* Search actors and directors */

async function searchPeople(query) {
    const cleaned = query.trim();

    if (!cleaned) {
        showMessage("peopleMessage", "Enter a person's name to search.");
        return;
    }

    showMessage("peopleMessage", "Searching for people...");
    $("peopleContainer").innerHTML = "";

    try {
        const data = await api("/search/person", {
            query: cleaned,
            language: "en-US",
            page: 1
        });

        const people = data.results || [];

        $("peopleContainer").innerHTML = people.length
            ? people.map(person => `
                <article class="person-card"
                    role="button"
                    tabindex="0"
                    data-open-person="${Number(person.id)}">

                    ${
                        person.profile_path
                            ? `<img class="person-image"
                                src="${posterURL(person.profile_path)}"
                                alt="${escapeHTML(person.name)}"
                                loading="lazy"
                                onerror="this.style.visibility='hidden'">`
                            : `<div class="person-image"></div>`
                    }

                    <div class="person-info">
                        <h3>${escapeHTML(person.name)}</h3>
                        <p>${escapeHTML(person.known_for_department || "Film professional")}</p>
                        <p>${escapeHTML(
                            (person.known_for || [])
                                .slice(0, 2)
                                .map(movieTitle)
                                .join(", ")
                        )}</p>
                    </div>
                </article>
            `).join("")
            : `<p class="empty-state">No matching people were found.</p>`;

        showMessage(
            "peopleMessage",
            people.length
                ? `Found ${people.length} people. Select a profile to see their filmography.`
                : "Try searching with a different spelling."
        );
    } catch (error) {
        console.error(error);
        showMessage("peopleMessage", error.message);
    }
}

$("peopleSearchForm").addEventListener("submit", event => {
    event.preventDefault();
    searchPeople($("peopleSearchInput").value);
});

/* Movie details */

async function openMovie(id) {
    const movie = state.movieCache.get(Number(id));
    if (!movie) return;

    state.lastMovieId = Number(id);

    state.history = [
        movie,
        ...state.history.filter(item =>
            Number(item.id) !== Number(id)
        )
    ].slice(0, 20);

    saveSaved("mf_history", state.history);
    renderHistory();
    renderHomeHistory();

    $("movieModal").classList.add("show");
    document.body.style.overflow = "hidden";

    $("movieDetails").innerHTML =
        `<p class="status-message">Loading movie details...</p>`;

    try {
        const detail = await api(`/movie/${id}`, {
            language: "en-US",
            append_to_response: "credits,videos,recommendations"
        });

        state.movieCache.set(Number(detail.id), detail);

        const director = (detail.credits?.crew || []).find(person =>
            person.job === "Director"
        );

        const cast = (detail.credits?.cast || []).slice(0, 8);

        const writers = (detail.credits?.crew || [])
            .filter(person => ["Writer", "Screenplay", "Story"].includes(person.job))
            .filter((person, index, all) =>
                all.findIndex(item => item.id === person.id) === index
            )
            .slice(0, 5);


        const videos = detail.videos?.results || [];

        const trailer = videos.find(video =>
            video.site === "YouTube" &&
            video.type === "Trailer" &&
            video.official
        ) || videos.find(video =>
            video.site === "YouTube" &&
            video.type === "Trailer"
        );

        const genres = (detail.genres || [])
            .map(genre => genre.name)
            .join(", ");

        $("movieDetails").innerHTML = `
            <div class="details-layout">
                <img class="details-poster"
                    src="${posterURL(detail.poster_path)}"
                    alt="${escapeHTML(detail.title)} poster"
                    onerror="this.style.display='none'">

                <div class="details-info">
                    <p class="eyebrow">MOVIE DETAILS</p>
                    <h2>${escapeHTML(detail.title)}</h2>

                    <div class="details-meta">
                        <span>${escapeHTML(yearOf(detail.release_date))}</span>
                        <span>Rating ${ratingOf(detail.vote_average)}/10</span>
                        ${detail.runtime ? `<span>${detail.runtime} min</span>` : ""}
                    </div>

                    <p>${escapeHTML(detail.overview || "No overview is available.")}</p>

                    <p>
                        <strong>Genre:</strong>
                        ${escapeHTML(genres || "Not listed")}
                    </p>


                    <p>
                        <strong>Writer:</strong>
                        ${writers.length
                            ? writers.map(person => escapeHTML(person.name)).join(", ")
                            : "Not listed"}
                    </p>

                    <p>
                        <strong>Director:</strong>
                        ${
                            director
                                ? `<button class="credit-button"
                                    data-open-person="${director.id}"
                                    type="button">
                                    ${escapeHTML(director.name)}
                                   </button>`
                                : "Not listed"
                        }
                    </p>

                    <div class="details-actions">
                        <button class="modal-action"
                            data-toggle="favorite"
                            data-id="${detail.id}"
                            type="button">
                            ${state.favorites.includes(Number(detail.id))
                                ? "Remove Favorite"
                                : "Add to Favorites"}
                        </button>

                        <button class="modal-action"
                            data-toggle="watchLater"
                            data-id="${detail.id}"
                            type="button">
                            ${state.watchLater.includes(Number(detail.id))
                                ? "Remove from Watch Later"
                                : "Watch Later"}
                        </button>

                        ${
                            trailer
                                ? `<a class="trailer-btn"
                                    href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}"
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    Watch Trailer
                                   </a>`
                                : ""
                        }
                    </div>

                    <div class="people-credit-list">
                        <h3>Cast</h3>
                        ${
                            cast.length
                                ? cast.map(person => `
                                    <button class="credit-button"
                                        data-open-person="${person.id}"
                                        type="button">
                                        ${escapeHTML(person.name)}
                                        <span> — ${escapeHTML(person.character || "Cast")}</span>
                                    </button>
                                `).join("")
                                : "<p>No cast details available.</p>"
                        }
                    </div>
                </div>
            </div>

            <div class="people-credit-list">
                <h3>More Like This</h3>
                <div class="movie-grid">
                    ${
                        (detail.recommendations?.results || [])
                            .slice(0, 5)
                            .map(movieCard)
                            .join("") ||
                        "<p>No recommendations available yet.</p>"
                    }
                </div>
            </div>
        `;

        state.recommendations = detail.recommendations?.results || [];

        state.recommendations.forEach(item => {
            state.movieCache.set(Number(item.id), item);
        });

        renderMovies(state.recommendations, "recommendationContainer");
    } catch (error) {
        console.error(error);

        $("movieDetails").innerHTML =
            `<p class="status-message">${escapeHTML(error.message)}</p>`;
    }
}

/* Actor and director profiles */

async function openPerson(id) {
    $("movieModal").classList.add("show");
    document.body.style.overflow = "hidden";

    $("movieDetails").innerHTML =
        `<p class="status-message">Loading profile...</p>`;

    try {
        const [person, credits] = await Promise.all([
            api(`/person/${id}`, { language: "en-US" }),
            api(`/person/${id}/combined_credits`, { language: "en-US" })
        ]);

        const allCredits = [
            ...(credits.cast || []),
            ...(credits.crew || [])
        ].filter(item =>
            item.media_type === "movie" || item.title
        );

        const movies = uniqueById(allCredits)
            .sort((a, b) =>
                Number(b.popularity || 0) - Number(a.popularity || 0)
            )
            .slice(0, 10);

        movies.forEach(movie => {
            state.movieCache.set(Number(movie.id), movie);
        });

        $("movieDetails").innerHTML = `
            <div class="details-layout">
                ${
                    person.profile_path
                        ? `<img class="person-detail-image"
                            src="${posterURL(person.profile_path)}"
                            alt="${escapeHTML(person.name)}"
                            onerror="this.style.display='none'">`
                        : ""
                }

                <div class="details-info">
                    <p class="eyebrow">ACTOR / DIRECTOR PROFILE</p>
                    <h2>${escapeHTML(person.name)}</h2>

                    <p>
                        <strong>Known for:</strong>
                        ${escapeHTML(person.known_for_department || "Film and television")}
                    </p>

                    <p>
                        <strong>Born:</strong>
                        ${escapeHTML(person.birthday || "Not listed")}
                    </p>

                    <p>
                        <strong>Place of birth:</strong>
                        ${escapeHTML(person.place_of_birth || "Not listed")}
                    </p>

                    <p>
                        ${escapeHTML(
                            person.biography ||
                            "A biography is not available for this person."
                        )}
                    </p>
                </div>
            </div>

            <div class="people-credit-list">
                <h3>Filmography</h3>
                <div class="movie-grid">
                    ${
                        movies.map(movieCard).join("") ||
                        "<p>No movie credits were found.</p>"
                    }
                </div>
            </div>
        `;
    } catch (error) {
        console.error(error);

        $("movieDetails").innerHTML =
            `<p class="status-message">${escapeHTML(error.message)}</p>`;
    }
}

/* Close movie details */

function closeModal() {
    $("movieModal").classList.remove("show");
    document.body.style.overflow = "";
}

$("closeModal").addEventListener("click", closeModal);

$("movieModal").addEventListener("click", event => {
    if (event.target === $("movieModal")) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }

    if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
            document.activeElement.tagName
        )
    ) {
        event.preventDefault();
        showPage("explore");
        $("exploreSearchInput").focus();
    }

    if (
        (event.key === "Enter" || event.key === " ") &&
        event.target.matches(".poster-container, .person-card")
    ) {
        event.preventDefault();

        if (event.target.matches(".poster-container")) {
            openMovie(event.target.dataset.openMovie);
        } else {
            openPerson(event.target.dataset.openPerson);
        }
    }
});

/* Favorites and Watch Later */

function toggleSaved(type, id) {
    const numberId = Number(id);

    if (!numberId) return;

    const key = type === "favorite"
        ? "favorites"
        : "watchLater";

    const storageKey = type === "favorite"
        ? "mf_favorites"
        : "mf_watch_later";

    const list = state[key];
    const index = list.indexOf(numberId);

    if (index >= 0) {
        list.splice(index, 1);
    } else {
        list.push(numberId);
    }

    saveSaved(storageKey, list);

    refreshVisibleMovies();
}

function refreshVisibleMovies() {
    renderMovies(state.currentMovies);
    renderMovies(state.featuredMovies.slice(0, 10), "trendingContainer");
    renderMovies(state.recommendations, "recommendationContainer");

    renderCollection();
    renderHistory();
    renderHomeHistory();

    if ($("movieModal").classList.contains("show")) {
        $("movieDetails").querySelectorAll("[data-toggle]").forEach(button => {
            const type = button.dataset.toggle;
            const id = Number(button.dataset.id);

            const saved = type === "favorite"
                ? state.favorites.includes(id)
                : state.watchLater.includes(id);

            button.textContent = type === "favorite"
                ? (saved ? "Remove Favorite" : "Add to Favorites")
                : (saved ? "Remove from Watch Later" : "Watch Later");
        });
    }
}

/* Collection page */

function renderCollection() {
    const container = $("collectionContainer");
    if (!container) return;

    const ids = state.collectionTab === "favorites"
        ? state.favorites
        : state.watchLater;

    const movies = ids
        .map(id => state.movieCache.get(Number(id)))
        .filter(Boolean);

    container.innerHTML = movies.length
        ? movies.map(movieCard).join("")
        : `<p class="empty-state">
            Your collection is empty. Add movies using the buttons on each movie card.
           </p>`;
}

$("showFavorites").addEventListener("click", () => {
    state.collectionTab = "favorites";

    $("showFavorites").classList.add("active");
    $("showWatchLater").classList.remove("active");

    renderCollection();
});

$("showWatchLater").addEventListener("click", () => {
    state.collectionTab = "watchLater";

    $("showWatchLater").classList.add("active");
    $("showFavorites").classList.remove("active");

    renderCollection();
});

/* Recently viewed */

function renderHistory() {
    const container = $("recentContainer");
    if (!container) return;

    container.innerHTML = state.history.length
        ? state.history.map(movieCard).join("")
        : `<p class="empty-state">Movies you open will appear here.</p>`;
}

function renderHomeHistory() {
    const container = $("homeRecentContainer");
    if (!container) return;

    container.innerHTML = state.history.length
        ? state.history.slice(0, 5).map(movieCard).join("")
        : `<p class="empty-state">Your viewed movies will appear here.</p>`;
}

/* Reliable click handling for all movie cards and modal buttons */

document.addEventListener("click", event => {
    const toggleButton = event.target.closest("[data-toggle]");

    if (toggleButton) {
        event.preventDefault();
        event.stopPropagation();

        toggleSaved(
            toggleButton.dataset.toggle,
            toggleButton.dataset.id
        );

        return;
    }

    const movieButton = event.target.closest("[data-open-movie]");

    if (movieButton) {
        event.preventDefault();

        openMovie(movieButton.dataset.openMovie);
        return;
    }

    const personButton = event.target.closest("[data-open-person]");

    if (personButton) {
        event.preventDefault();

        openPerson(personButton.dataset.openPerson);
    }
});

/* Search filters */

document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        state.filter = button.dataset.filter;

        document.querySelectorAll("[data-filter]").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderMovies(state.currentMovies);
    });
});

$("genreFilter").addEventListener("change", async () => {
    const genre = $("genreFilter").value;

    if (genre === "all") {
        state.currentMovies = state.featuredMovies;
        $("resultsTitle").textContent = "Popular movies";
        showMessage("message", "Showing popular movies.");
        renderMovies(state.currentMovies);
        return;
    }

    showMessage("message", "Finding movies in this genre...");
    $("movieContainer").innerHTML = "";

    try {
        const data = await api("/discover/movie", {
            with_genres: genre,
            sort_by: "popularity.desc",
            include_adult: false,
            language: "en-US",
            page: 1
        });

        state.currentMovies = data.results || [];
        state.filter = "all";
        document.querySelectorAll("[data-filter]").forEach(button => {
            button.classList.toggle("active", button.dataset.filter === "all");
        });

        const genreName = state.genreMap[genre] || "selected genre";
        $("resultsTitle").textContent = `Recommended ${genreName} movies`;
        showMessage(
            "message",
            state.currentMovies.length
                ? `Here are popular movies in the ${genreName} genre.`
                : `No movies were found for ${genreName}. Try another genre.`
        );
        renderMovies(state.currentMovies);
    } catch (error) {
        console.error(error);
        showMessage("message", error.message);
    }
});

$("ratingFilter").addEventListener("change", () => {
    renderMovies(state.currentMovies);
});

/* Load genres */

async function loadGenres() {
    try {
        const data = await api("/genre/movie/list", {
            language: "en-US"
        });

        $("genreFilter").innerHTML =
            '<option value="all">All genres</option>' +
            (data.genres || []).map(genre =>
                `<option value="${genre.id}">
                    ${escapeHTML(genre.name)}
                 </option>`
            ).join("");

        state.genreMap = Object.fromEntries(
            (data.genres || []).map(genre => [
                genre.id,
                genre.name
            ])
        );
    } catch (error) {
        console.error(error);
        showMessage("message", error.message);
    }
}

/* Scroll-to-top button */

window.addEventListener("scroll", () => {
    $("scrollTopButton").classList.toggle(
        "visible",
        window.scrollY > 450
    );
});

$("scrollTopButton").addEventListener("click", () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});

/* Start MovieFinder */

async function init() {
    await Promise.all([
        loadGenres(),
        loadFeaturedMovies()
    ]);

    state.history.forEach(movie => {
        if (movie && movie.id) {
            state.movieCache.set(Number(movie.id), movie);
        }
    });

    renderCollection();
    renderHistory();
    renderHomeHistory();
}

init();
