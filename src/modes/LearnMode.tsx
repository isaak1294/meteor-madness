import { useState } from 'react'
import { useSimStore } from '../state/useSimStore'

const learnContent = {
  'What Are Asteroids?': {
    title: 'What Are Asteroids?',
    pages: [
      {
        content: `Asteroids are space rocks that orbit the Sun, just like planets do.`
      },
      {
        content: `Most asteroids live in the asteroid belt between Mars and Jupiter.`
      },
      {
        content: `They come in all shapes and sizes, from tiny pebbles to massive rocks as big as mountains.`
      }
    ]
  },
  'Near-Earth Asteroids': {
    title: 'Near-Earth Asteroids',
    pages: [
      {
        content: `Some asteroids don't stay in the belt and travel close to Earth.`
      },
      {
        content: `These are called Near-Earth Asteroids, or NEAs for short.`
      },
      {
        content: `NASA tracks thousands of them to make sure none are heading toward our planet.`
      }
    ]
  },
  'What Are Asteroids Made Of?': {
    title: 'What Are Asteroids Made Of?',
    pages: [
      {
        content: `Asteroids are made of different materials depending on where they formed.`
      },
      {
        content: `Rocky asteroids are mostly stone, similar to Earth's crust.`
      },
      {
        content: `Metallic asteroids contain lots of iron and nickel.`
      },
      {
        content: `Carbon-rich asteroids are darker and older, made from ancient dust and ice.`
      },
      {
        content: `Scientists study asteroids because they're like time capsules from when our solar system formed.`
      }
    ]
  },
  'What Happens If an Asteroid Hits Earth?': {
    title: 'What Happens If an Asteroid Hits Earth?',
    pages: [
      {
        content: `When a large asteroid hits Earth, it can cause serious damage.`
      },
      {
        content: `It creates a crater, which is a huge hole in the ground.`
      },
      {
        content: `The impact creates a powerful shockwave that can travel for miles.`
      },
      {
        content: `If it lands in the ocean, it can create massive waves or tsunamis.`
      },
      {
        content: `Dust and debris thrown into the air can block sunlight and cool the planet for years.`
      },
      {
        content: `The good news is that NASA says no known asteroid is heading toward Earth anytime soon.`
      }
    ]
  },
  'How Do We Stop an Asteroid?': {
    title: 'How Do We Stop an Asteroid?',
    pages: [
      {
        content: `Scientists have several methods to protect Earth from dangerous asteroids.`
      },
      {
        content: `Kinetic Impactor: crash a spacecraft into the asteroid to push it off course, like NASA's DART mission did.`
      },
      {
        content: `Gravity Tractor: use a spacecraft's gravity to slowly pull the asteroid away over time.`
      },
      {
        content: `Nuclear Option: use an explosion to change its direction, but only as a last resort.`
      },
      {
        content: `The key is acting early. Even a small push years before impact can make a huge difference.`
      }
    ]
  },
  'What Can Happen After an Impact?': {
    title: 'What Can Happen After an Impact?',
    pages: [
      {
        content: `The effects of an asteroid impact depend on where it lands.`
      },
      {
        content: `Ocean impacts create giant waves and tsunamis that can reach far inland.`
      },
      {
        content: `Land impacts cause earthquakes, fires, and massive dust clouds.`
      },
      {
        content: `Near cities, the shockwave can damage buildings and infrastructure.`
      },
      {
        content: `Scientists study impact zones using NASA and USGS data to understand how to protect people.`
      }
    ]
  },
  'How Do We Find and Track Asteroids?': {
    title: 'How Do We Find and Track Asteroids?',
    pages: [
      {
        content: `NASA uses powerful telescopes on Earth and in space to find and track asteroids.`
      },
      {
        content: `They use advanced math and computers to predict where asteroids will be years in the future.`
      },
      {
        content: `This is how they know if any asteroids might be a threat to Earth.`
      },
      {
        content: `All this data is shared through NASA's NEO API, which this app uses to show you real asteroid information.`
      }
    ]
  },
  'How This App Helps You Learn': {
    title: 'How This App Helps You Learn',
    pages: [
      {
        content: `This asteroid simulator lets you experiment with different scenarios.`
      },
      {
        content: `You can adjust an asteroid's size, speed, and approach angle.`
      },
      {
        content: `Watch what happens when it hits Earth in real-time.`
      },
      {
        content: `See real NASA asteroid data in action.`
      },
      {
        content: `Learn how different mitigation strategies can save the planet.`
      },
      {
        content: `Test your knowledge with trivia questions about space and asteroids.`
      }
    ]
  }
}

export default function LearnMode() {
  const { learnVisible, closeLearn } = useSimStore(s => ({
    learnVisible: s.learnVisible,
    closeLearn: s.closeLearn
  }))
  
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  if (!learnVisible) return null

  const topics = Object.keys(learnContent)
  const currentTopic = selectedTopic ? learnContent[selectedTopic as keyof typeof learnContent] : null
  const totalPages = currentTopic ? currentTopic.pages.length : 0

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic)
    setCurrentPage(0)
  }

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleBackToTopics = () => {
    setSelectedTopic(null)
    setCurrentPage(0)
  }

  return (
    <div className="learn-overlay">
      <div className="learn-modal">
        <div className="learn-header">
          <h2>Learn About Asteroids</h2>
          <button className="learn-close" onClick={closeLearn}>×</button>
        </div>

        {!selectedTopic ? (
          <div className="learn-topics">
            <p>Pick a topic to learn more:</p>
            <div className="topics-list">
              {topics.map(topic => (
                <button
                  key={topic}
                  className="topic-button"
                  onClick={() => handleTopicSelect(topic)}
                >
                  {learnContent[topic as keyof typeof learnContent].title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="learn-content">
            <div className="learn-topic-header">
              <button className="back-button" onClick={handleBackToTopics}>
                ← Back
              </button>
              <h3>{currentTopic?.title}</h3>
            </div>

            <div className="learn-page">
              <div className="page-content">
                <p>{currentTopic?.pages[currentPage]?.content}</p>
              </div>

              <div className="page-navigation">
                <button
                  className="nav-button"
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                >
                  Previous
                </button>
                <span className="page-indicator">
                  {currentPage + 1} of {totalPages}
                </span>
                <button
                  className="nav-button"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
